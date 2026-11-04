import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { deleteMyAccount } from '../lib/db';
import { reportError } from '../lib/monitoring';
import { setMonitoringUser } from '../lib/monitoring';
import { disablePush } from '../lib/push';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  // 로그인 없이 체험: Supabase 익명 계정 (이 기기에만 연결, 나중에 이메일·구글로 정식 계정 전환)
  isGuest: boolean;
  signInAsGuest: () => Promise<{ error: string | null }>;
  upgradeWithEmail: (email: string) => Promise<{ error: string | null }>;
  linkGoogle: () => Promise<{ error: string | null }>;
  // 체험 중에 이미 있는 계정으로 로그인 (체험 데이터는 옮기지 않고 지움)
  loginFromGuest: (email: string, password: string) => Promise<{ error: string | null }>;
  googleLoginFromGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  // 비밀번호 재설정 메일의 링크로 들어온 상태 (새 비밀번호를 정하는 창을 띄워야 함)
  passwordRecovery: boolean;
  endPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // 재설정 메일 링크로 들어오면 로그인은 된 상태가 되므로, 새 비밀번호부터 정하게 함
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 오류 기록에 어느 계정에서 났는지(UUID만) 붙임
  useEffect(() => { setMonitoringUser(user?.id ?? null); }, [user?.id]);

  async function signUp(email: string, password: string, displayName?: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName ?? email.split('@')[0] } },
    });
    return { error: error?.message ?? null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  }

  async function signInAsGuest() {
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: '게스트' } } });
    return { error: error?.message ?? null };
  }

  // 게스트 → 이메일 계정: 이메일 확인 메일의 링크를 누르면 같은 계정(데이터 그대로)이 정식 계정이 됨
  async function upgradeWithEmail(email: string) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: window.location.origin });
    return { error: error?.message ?? null };
  }

  // 게스트 → 구글 계정: 지금 계정에 구글을 연결 (Supabase에서 Manual Linking을 켜 둬야 함)
  async function linkGoogle() {
    const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: window.location.origin } });
    return { error: error?.message ?? null };
  }

  // 체험 계정을 지움 (실패해도 로그인은 계속: 남은 체험 데이터는 본인만 볼 수 있고 다시 들어올 방법이 없을 뿐)
  async function dropGuest() {
    if (!user?.is_anonymous) return;
    try { await deleteMyAccount(user.id); } catch (e) { reportError(e, 'delete guest before login'); }
  }

  // 체험 중 → 이메일 계정으로 로그인. 비밀번호가 틀려도 체험 데이터가 지워지지 않도록,
  // 따로 만든 임시 연결로 먼저 로그인해 보고 성공했을 때만 체험 계정을 지우고 그 계정으로 바꿈
  async function loginFromGuest(email: string, password: string) {
    const probe = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'moa-guest-login-probe' } });
    const { data, error } = await probe.auth.signInWithPassword({ email, password });
    if (error || !data.session) return { error: error?.message ?? 'login failed' };
    await dropGuest();
    const { error: setError } = await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    return { error: setError?.message ?? null };
  }

  // 체험 중 → 구글 계정으로 로그인 (구글 화면으로 넘어가므로 넘어가기 전에 체험 계정을 지움)
  async function googleLoginFromGuest() {
    await dropGuest();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return signInWithGoogle();
  }

  async function signOut() {
    // 이 기기로 이전 계정의 타임박스 알림이 계속 오지 않도록 로그아웃 전에 알림 구독을 정리
    await disablePush().catch(() => {});
    await supabase.auth.signOut();
  }

  async function resetPassword(email: string) {
    // 이 앱은 주소(경로)별 화면이 없는 한 페이지 앱이라, 예전의 /reset-password 경로는
    // 호스팅 설정에 따라 404가 나거나 새 비밀번호를 묻지 않고 그냥 로그인만 됐음.
    // 앱 첫 주소로 돌아오게 하고, PASSWORD_RECOVERY 이벤트로 새 비밀번호 창을 띄움
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: error?.message ?? null };
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }

  return (
    <AuthContext.Provider value={{
      user, session, loading, signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword,
      isGuest: user?.is_anonymous ?? false, signInAsGuest, upgradeWithEmail, linkGoogle, loginFromGuest, googleLoginFromGuest,
      passwordRecovery, endPasswordRecovery: () => setPasswordRecovery(false),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

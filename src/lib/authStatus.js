export function isEmailVerified(user) {
  return Boolean(
    user?.email_confirmed_at ||
    user?.confirmed_at ||
    user?.email_verified ||
    user?.user_metadata?.email_verified
  );
}

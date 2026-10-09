// FreedomDay settings. Fill these in from Supabase > Project Settings > API.
// Set SUPABASE_URL to "" to run the app in demo mode with sample numbers.
// Never put the service_role / secret key here.
window.FREEDOMDAY_CONFIG = {
  SUPABASE_URL: "https://rlgjuywykzqenifueaty.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable__7LBOc8QYxqn2BROb01TEA_llstxk8Z", // publishable key: safe to put in a web page
  LOGIN_VIA_FUNCTION: true, // sign-in goes through the auth-login function (lockout after 5 wrong passwords)
};

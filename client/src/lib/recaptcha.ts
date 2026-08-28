/**
 * Loads and executes Google Invisible reCAPTCHA v3
 */
const RECAPTCHA_SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_SITE_KEY ||
  import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ||
  "";

let scriptLoaded = false;

export function loadRecaptchaScript(): Promise<void> {
  return new Promise((resolve) => {
    if (!RECAPTCHA_SITE_KEY || typeof window === "undefined") {
      return resolve();
    }
    if ((window as any).grecaptcha) {
      return resolve();
    }
    if (scriptLoaded) {
      return resolve();
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      console.warn("[reCAPTCHA] Failed to load Google reCAPTCHA script.");
      resolve();
    };
    document.head.appendChild(script);
  });
}

/**
 * Executes invisible reCAPTCHA v3 and returns a security token
 */
export async function getRecaptchaToken(action: string = "submit"): Promise<string | undefined> {
  if (!RECAPTCHA_SITE_KEY) return undefined;
  await loadRecaptchaScript();
  const grecaptcha = (window as any).grecaptcha;
  if (!grecaptcha || !grecaptcha.execute) return undefined;

  try {
    return await new Promise<string>((resolve) => {
      grecaptcha.ready(async () => {
        try {
          const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch {
          resolve(undefined as any);
        }
      });
    });
  } catch (err) {
    console.warn("[reCAPTCHA Execution Error]:", err);
    return undefined;
  }
}

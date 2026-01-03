/**
 * Admin Configuration
 * 
 * Admin Email: mohimmolla020@gmail.com
 * Admin Password: Wordpress@2026
 * Admin Secret Key: Softvence,Quize,Admin-dashboard
 * 
 * Note: This email is the only email that can access the admin dashboard.
 * The admin role is automatically granted when this email signs up or logs in.
 * Alternatively, any user can become admin by entering the admin secret key during registration or login.
 */

export const ADMIN_EMAIL = 'mohimmolla020@gmail.com';
export const ADMIN_PASSWORD = 'Wordpress@2026'; // For reference/documentation only
export const ADMIN_SECRET_KEY = 'Softvence,Quize,Admin-dashboard'; // Secret key for admin access

/**
 * Check if an email is the admin email
 */
export const isAdminEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
};

/**
 * Check if a secret key matches the admin secret key
 */
export const isAdminSecretKey = (secretKey: string | null | undefined): boolean => {
    if (!secretKey) return false;
    return secretKey.trim() === ADMIN_SECRET_KEY;
};


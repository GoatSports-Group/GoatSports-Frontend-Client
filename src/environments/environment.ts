export const environment = {
    production: false,

    authApiUrl: process.env['NG_APP_AUTH_API_URL'] || "http://localhost:4400",
    adminApiUrl: process.env['NG_APP_ADMIN_API_URL'] || "http://localhost:4300",
    clientApiUrl: process.env['NG_APP_CLIENT_API_URL'] || "http://localhost:4200",

    apiUrl: process.env['NG_APP_API_URL'] || "http://localhost:7070",
};
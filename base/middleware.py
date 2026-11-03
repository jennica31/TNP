from django.conf import settings


class ContentSecurityPolicyMiddleware:
    """
    Adds Content-Security-Policy, Referrer-Policy, and Permissions-Policy headers
    to restrict resource loading, mitigate XSS, and protect browser context.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if getattr(settings, "IS_DEV", False):
            policy = "; ".join([
                "default-src 'self' 'unsafe-inline' 'unsafe-eval' http: https: data: blob: ws: wss:",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' data: https://fonts.gstatic.com",
                "img-src 'self' data: blob: https: http:",
                "connect-src 'self' http: https: ws: wss:",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action *",
            ])
        else:
            client_url = getattr(settings, "CLIENT_URL", "")
            policy = "; ".join([
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com",
                "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: https://zctindia.org",
                "connect-src 'self' " + client_url + " https://cloudflareinsights.com",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self' " + client_url,
            ])
        response["Content-Security-Policy"] = policy
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        return response


class NoCacheMiddleware:
    """
    Middleware to add Cache-Control headers to prevent the browser from caching
    authenticated responses. This ensures the back button doesn't reveal protected
    pages after logout.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if "text/html" in response.get("Content-Type", "") or "application/json" in response.get("Content-Type", ""):
            response["Cache-Control"] = "no-store, no-cache, private, must-revalidate"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
        return response

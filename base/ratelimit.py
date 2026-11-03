"""Client IP resolution for django-ratelimit and security auditing.

Pointed at by `RATELIMIT_IP_META_KEY`.
"""


def client_ip(request):
    """Return the client IP for rate-limit bucketing and audit logging.

    Prefers `CF-Connecting-IP` when behind Cloudflare / Cloudflare Tunnel,
    as this cannot be forged by an end-user client.
    Otherwise, checks the left-most entry of `X-Forwarded-For`, falling
    back to `REMOTE_ADDR`.
    """
    cf_ip = request.META.get("HTTP_CF_CONNECTING_IP", "").strip()
    if cf_ip:
        return cf_ip

    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    for candidate in forwarded.split(","):
        candidate = candidate.strip()
        if candidate:
            return candidate
    return request.META.get("REMOTE_ADDR") or "0.0.0.0"

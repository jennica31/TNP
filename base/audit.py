import logging
import uuid
from django.utils import timezone
from base.ratelimit import client_ip

logger = logging.getLogger("security.audit")

def log_security_event(
    event_type: str,
    request=None,
    user=None,
    target_user=None,
    status: str = "SUCCESS",
    details: dict = None,
):
    """
    Emits a structured audit log entry for security-relevant actions.
    Never includes raw passwords, auth tokens, or private secrets.
    """
    ip = client_ip(request) if request else "0.0.0.0"
    user_id = str(user.id) if user and getattr(user, "id", None) else None
    user_email = getattr(user, "email", "anonymous") if user else "anonymous"
    target_id = str(target_user.id) if target_user and getattr(target_user, "id", None) else None
    
    entry = {
        "event_id": str(uuid.uuid4()),
        "timestamp": timezone.now().isoformat(),
        "event_type": event_type,
        "status": status,
        "actor_user_id": user_id,
        "actor_email": user_email,
        "ip_address": ip,
        "target_user_id": target_id,
        "details": details or {},
    }
    
    if status == "SUCCESS":
        logger.info("AUDIT_EVENT: %s", entry)
    else:
        logger.warning("AUDIT_EVENT_FAILURE: %s", entry)
    return entry


import logging
import re

SENSITIVE_PATTERNS = [
    re.compile(r'(password|passwd|secret|token|api_key|authorization|bearer)\s*[:=]\s*([^\s,;]+)', re.IGNORECASE),
    re.compile(r'("?(?:password|passwd|secret|token|api_key|authorization)"?\s*:\s*)"([^"]+)"', re.IGNORECASE),
]

class SensitiveDataFilter(logging.Filter):
    """
    Redacts sensitive credentials, tokens, secrets, and auth headers from log messages.
    Ensures passwords and API tokens never leak into application logs or log aggregators.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.mask_sensitive(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: ("***REDACTED***" if any(s in str(k).lower() for s in ("pass", "secret", "token", "auth")) else v) for k, v in record.args.items()}
            elif isinstance(record.args, (list, tuple)):
                record.args = tuple(self.mask_arg(a) for a in record.args)
        return True

    @staticmethod
    def mask_sensitive(text: str) -> str:
        for pattern in SENSITIVE_PATTERNS:
            text = pattern.sub(r'\1: ***REDACTED***', text)
        return text

    @classmethod
    def mask_arg(cls, arg):
        if isinstance(arg, str):
            return cls.mask_sensitive(arg)
        return arg


import random
import string

from .config import settings


def generate_room_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(settings.room_code_length))

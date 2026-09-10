from pydantic import BaseModel


SUPPORTED_UNLOCKS = frozenset(
    {"movement", "if", "variables", "for_loop", "lists", "functions"}
)


class ProgressPublic(BaseModel):
    unlocks: list[str]

from pydantic import BaseModel


SUPPORTED_UNLOCKS = frozenset(
    {
        "movement", "if", "variables", "for_loop", "lists", "functions",
        "tutorial_linear_1", "tutorial_linear_2",
    }
)


class ProgressPublic(BaseModel):
    unlocks: list[str]

from pydantic import BaseModel, Field


class TutorialState(BaseModel):
    current_task: int | None
    completed: list[int]


class TutorialSubmission(BaseModel):
    task: int
    code: str = Field(max_length=4000)


class TutorialResult(TutorialState):
    correct: bool
    output: str
    error: str | None = None

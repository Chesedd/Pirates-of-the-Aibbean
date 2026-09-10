from pydantic import BaseModel, ConfigDict


class PlayerCodePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str


class PlayerCodePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str

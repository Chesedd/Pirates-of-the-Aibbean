from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import current_user
from app.database.session import get_db
from app.game.island_geometry import SAFE_SPAWN, position_is_on_island
from app.models.user import Island, PlayerCode, User, UserProgress, UserUnlock
from app.schemas.code import PlayerCodePayload, PlayerCodePublic
from app.schemas.island import IslandPublic, PlayerPositionUpdate
from app.schemas.progress import ProgressPublic
from app.schemas.tutorial import TutorialResult, TutorialState, TutorialSubmission
from app.services.tutorial import TUTORIAL_TASKS, TutorialCodeError, run_tutorial_code

router = APIRouter(prefix="/game", tags=["game"])

TUTORIAL_KEYS = ("tutorial_linear_1", "tutorial_linear_2", "tutorial_if_1", "tutorial_if_2")


def _tutorial_state(progress: UserProgress) -> TutorialState:
    keys = {unlock.key for unlock in progress.unlocks}
    completed = [number for number, key in enumerate(TUTORIAL_KEYS, 1) if key in keys]
    current_task = next((number for number in range(1, 5) if number not in completed), None)
    return TutorialState(current_task=current_task, completed=completed)


@router.get("/tutorial", response_model=TutorialState)
def get_tutorial(user: User = Depends(current_user), db: Session = Depends(get_db)) -> TutorialState:
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == user.id))
    if progress is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Progress not found")
    return _tutorial_state(progress)


@router.post("/tutorial/check", response_model=TutorialResult)
def check_tutorial(
    payload: TutorialSubmission,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> TutorialResult:
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == user.id))
    if progress is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Progress not found")
    state = _tutorial_state(progress)
    if payload.task not in range(1, 5) or payload.task != state.current_task:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete tutorial tasks in order")
    try:
        task = TUTORIAL_TASKS[payload.task]
        output = run_tutorial_code(payload.code, task=task)
    except TutorialCodeError as exc:
        return TutorialResult(**state.model_dump(), correct=False, output="", error=str(exc))
    correct = output == task.expected_output
    if correct:
        db.add(UserUnlock(progress_id=progress.id, key=TUTORIAL_KEYS[payload.task - 1]))
        if payload.task == 4:
            # The final task and movement are persisted in one transaction.  There is
            # intentionally no client endpoint that can grant this unlock directly.
            db.add(UserUnlock(progress_id=progress.id, key="movement"))
        db.commit()
        db.refresh(progress)
        state = _tutorial_state(progress)
    return TutorialResult(
        **state.model_dump(),
        correct=correct,
        output=output,
        error=None if correct else "Результат пока не совпадает с ожидаемым.",
    )


@router.get("/progress", response_model=ProgressPublic)
def get_progress(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> ProgressPublic:
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == user.id))
    if progress is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Progress not found")
    return ProgressPublic(unlocks=sorted(unlock.key for unlock in progress.unlocks))


@router.get("/island", response_model=IslandPublic)
def get_island(user: User = Depends(current_user), db: Session = Depends(get_db)) -> IslandPublic:
    island = db.scalar(select(Island).where(Island.user_id == user.id))
    if island is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Island not found")
    if not position_is_on_island(island.generation_seed, island.player_x, island.player_y):
        island.player_x, island.player_y = SAFE_SPAWN
        db.commit()
        db.refresh(island)
    return IslandPublic.from_island(island)


@router.put("/position", response_model=IslandPublic)
def update_position(payload: PlayerPositionUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> IslandPublic:
    island = db.scalar(select(Island).where(Island.user_id == user.id))
    if island is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Island not found")
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == user.id))
    if progress is None or not any(unlock.key == "movement" for unlock in progress.unlocks):
        # Coordinates are server-owned. Running arbitrary player.py remains allowed, but
        # it cannot use this endpoint to escape the tutorial before the unlock exists.
        return IslandPublic.from_island(island)
    if not position_is_on_island(island.generation_seed, payload.x, payload.y):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Position is outside the island")
    island.player_x, island.player_y = payload.x, payload.y
    db.commit()
    db.refresh(island)
    return IslandPublic.from_island(island)


@router.get("/code", response_model=PlayerCodePublic)
def get_code(user: User = Depends(current_user), db: Session = Depends(get_db)) -> PlayerCode:
    player_code = db.scalar(select(PlayerCode).where(PlayerCode.user_id == user.id))
    if player_code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Player code not found")
    return player_code


@router.put("/code", response_model=PlayerCodePublic)
def save_code(
    payload: PlayerCodePayload,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PlayerCode:
    player_code = db.scalar(select(PlayerCode).where(PlayerCode.user_id == user.id))
    if player_code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Player code not found")
    player_code.code = payload.code
    db.commit()
    db.refresh(player_code)
    return player_code

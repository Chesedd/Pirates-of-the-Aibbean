"""Add extensible per-user progress and unlock records."""
from alembic import op
import sqlalchemy as sa

revision = "20260910_04"
down_revision = "20260910_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_user_progress_user_id"),
    )
    op.create_index("ix_user_progress_user_id", "user_progress", ["user_id"], unique=True)
    op.create_table(
        "user_unlocks",
        sa.Column("progress_id", sa.Integer(), sa.ForeignKey("user_progress.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("key", sa.String(length=50), primary_key=True),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute(
        sa.text(
            "INSERT INTO user_progress (user_id) SELECT id FROM users WHERE role = 'user' "
            "AND NOT EXISTS (SELECT 1 FROM user_progress WHERE user_progress.user_id = users.id)"
        )
    )


def downgrade() -> None:
    op.drop_table("user_unlocks")
    op.drop_table("user_progress")

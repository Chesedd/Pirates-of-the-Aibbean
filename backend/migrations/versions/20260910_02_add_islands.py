"""Add one personal island for every regular user."""
from alembic import op
import sqlalchemy as sa

revision = "20260910_02"
down_revision = "20260910_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "islands",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("player_x", sa.Integer(), server_default="400", nullable=False),
        sa.Column("player_y", sa.Integer(), server_default="300", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_islands_user_id"),
    )
    op.create_index("ix_islands_user_id", "islands", ["user_id"], unique=True)
    op.execute(
        sa.text(
            "INSERT INTO islands (user_id, player_x, player_y) "
            "SELECT id, 400, 300 FROM users WHERE role = 'user' "
            "AND NOT EXISTS (SELECT 1 FROM islands WHERE islands.user_id = users.id)"
        )
    )


def downgrade() -> None:
    op.drop_table("islands")

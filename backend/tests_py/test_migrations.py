import pytest
from alembic.config import Config
from alembic import command
import os

def test_alembic_migrations_roundtrip():
    # Alembic config path
    ini_path = "backend/alembic.ini" if os.path.exists("backend/alembic.ini") else "alembic.ini"
    alembic_cfg = Config(ini_path)
    
    # Test downgrade to initial platform
    command.downgrade(alembic_cfg, "0001_initial_platform")
    
    # Test upgrade to head
    command.upgrade(alembic_cfg, "head")

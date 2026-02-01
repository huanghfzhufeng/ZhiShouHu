"""
Centralized logging configuration for Senior Guardian System
"""
import logging
import os
import sys

# Log level from environment, default to INFO
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Create formatter
formatter = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# Create console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)


def get_logger(name: str) -> logging.Logger:
    """
    Get a configured logger instance.
    
    Usage:
        from app.logger import get_logger
        logger = get_logger(__name__)
        logger.info("Something happened")
    """
    logger = logging.getLogger(name)
    
    # Avoid adding handlers multiple times
    if not logger.handlers:
        logger.addHandler(console_handler)
        logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    
    return logger


# Pre-configured loggers for common modules
app_logger = get_logger("app")
api_logger = get_logger("app.api")
db_logger = get_logger("app.db")
service_logger = get_logger("app.services")

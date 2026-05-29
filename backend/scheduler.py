from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
import threading

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def scheduled_scan():
    """Run the full scan as a scheduled job."""
    from database import SessionLocal
    from scanner import run_full_scan

    logger.info("Starting scheduled scan...")
    db = SessionLocal()
    try:
        setups = run_full_scan(db_session=db)
        logger.info(f"Scheduled scan complete. Found {len(setups)} setups.")

        # Send Telegram alert if configured
        from models import Config
        token = db.query(Config).filter(Config.key == "telegram_token").first()
        chat_id = db.query(Config).filter(Config.key == "telegram_chat_id").first()

        if token and chat_id and token.value and chat_id.value:
            import asyncio
            from alerts import send_telegram_alert
            asyncio.run(send_telegram_alert(token.value, chat_id.value, setups))
    except Exception as e:
        logger.error(f"Scheduled scan failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler with nightly scan at 4:30 PM IST (11:00 UTC)."""
    scheduler.add_job(
        scheduled_scan,
        CronTrigger(hour=16, minute=30, timezone="Asia/Kolkata", day_of_week="mon-fri"),
        id="nightly_scan",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started - scan scheduled for 4:30 PM IST, Mon-Fri")


def stop_scheduler():
    scheduler.shutdown()

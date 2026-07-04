"""AI Social Media Automated Posting Pipeline.

A small, extensible pipeline that:
  1. Generates social media post copy with an LLM (or an offline template
     fallback when no API key is configured).
  2. Optionally routes drafts through a human-approval step.
  3. Publishes approved posts to one or more social platforms.
  4. Schedules recurring posts and keeps a de-duplicated history.
"""

__version__ = "0.1.0"

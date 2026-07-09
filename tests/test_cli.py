from click.testing import CliRunner

from ai_social_pipeline.cli import cli


def test_cli_generate_offline(settings, monkeypatch):
    monkeypatch.setenv("PIPELINE_DATA_DIR", str(settings.data_dir))
    monkeypatch.setenv("PIPELINE_DRAFTS_DIR", str(settings.drafts_dir))
    monkeypatch.setenv("PIPELINE_HISTORY_DB", str(settings.history_db_path))
    monkeypatch.setenv("PIPELINE_QUEUE_FILE", str(settings.queue_file_path))

    runner = CliRunner()
    result = runner.invoke(cli, ["generate", "--topic", "testing", "--platform", "mock"])

    assert result.exit_code == 0
    assert "testing" in result.output.lower() or len(result.output.strip()) > 0


def test_cli_post_saves_draft(settings, monkeypatch):
    monkeypatch.setenv("PIPELINE_DATA_DIR", str(settings.data_dir))
    monkeypatch.setenv("PIPELINE_DRAFTS_DIR", str(settings.drafts_dir))
    monkeypatch.setenv("PIPELINE_HISTORY_DB", str(settings.history_db_path))
    monkeypatch.setenv("PIPELINE_QUEUE_FILE", str(settings.queue_file_path))
    monkeypatch.setenv("PIPELINE_AUTO_APPROVE", "false")
    monkeypatch.setenv("PIPELINE_DRY_RUN", "true")

    runner = CliRunner()
    result = runner.invoke(cli, ["post", "--topic", "draft me", "--platform", "mock"])

    assert result.exit_code == 0
    assert "Saved as draft" in result.output


def test_cli_schedule_once_no_jobs(settings, monkeypatch):
    monkeypatch.setenv("PIPELINE_DATA_DIR", str(settings.data_dir))
    monkeypatch.setenv("PIPELINE_DRAFTS_DIR", str(settings.drafts_dir))
    monkeypatch.setenv("PIPELINE_HISTORY_DB", str(settings.history_db_path))
    monkeypatch.setenv("PIPELINE_QUEUE_FILE", str(settings.queue_file_path))

    runner = CliRunner()
    result = runner.invoke(cli, ["schedule-once"])

    assert result.exit_code == 0
    assert "No jobs due" in result.output

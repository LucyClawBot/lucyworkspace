#!/bin/bash
# LucyWorkspace Mission Worker
# VPS Worker Contract: Claims and executes steps
# Run on Mac/server: ./worker.sh

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_KEY:-}"
WORKER_ID="${WORKER_ID:-$(hostname)}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_KEY must be set"
  echo "Add to ~/.zshrc:"
  echo "export SUPABASE_URL='your-url'"
  echo "export SUPABASE_KEY='your-key'"
  echo "export WORKER_ID='lucy-macbook'"
  exit 1
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Claim a step
claim_step() {
  local step_id=$1
  local reserved_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  curl -s -X PATCH \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"status\": \"running\", \"worker\": \"$WORKER_ID\", \"reserved_at\": \"$reserved_at\"}" \
    "$SUPABASE_URL/rest/v1/ops_mission_steps?id=eq.$step_id&status=eq.queued" 2>/dev/null
}

# Mark step as succeeded
complete_step() {
  local step_id=$1
  local output=$2
  local updated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  curl -s -X PATCH \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"status\": \"succeeded\", \"output\": $(echo "$output" | jq -R -s .), \"updated_at\": \"$updated_at\"}" \
    "$SUPABASE_URL/rest/v1/ops_mission_steps?id=eq.$step_id" 2>/dev/null
}

# Mark step as failed
fail_step() {
  local step_id=$1
  local error=$2
  local updated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  curl -s -X PATCH \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"status\": \"failed\", \"last_error\": $(echo "$error" | jq -R -s .), \"updated_at\": \"$updated_at\"}" \
    "$SUPABASE_URL/rest/v1/ops_mission_steps?id=eq.$step_id" 2>/dev/null
}

# Log action run
log_action() {
  local step_id=$1
  local output=$2
  local error=$3
  local started_at=$4
  local completed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  curl -s -X POST \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"step_id\": \"$step_id\", \"output\": $(echo "$output" | jq -R -s .), \"error\": $(echo "$error" | jq -R -s .), \"started_at\": \"$started_at\", \"completed_at\": \"$completed_at\"}" \
    "$SUPABASE_URL/rest/v1/ops_action_runs" 2>/dev/null
}

# Execute step based on kind
execute_step() {
  local step_id=$1
  local kind=$2
  local params=$3
  local started_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  log "▶️ Executing step $step_id ($kind)"
  
  local output=""
  local error=""
  local exit_code=0

  case "$kind" in
    analyze)
      output=$(analyze_data "$params")
      ;;
    crawl)
      output=$(crawl_web "$params")
      ;;
    write_content)
      output=$(write_content "$params")
      ;;
    draft_tweet)
      output=$(draft_tweet "$params")
      ;;
    post_tweet)
      output=$(post_tweet "$params")
      ;;
    review_content)
      output=$(review_content "$params")
      ;;
    *)
      error="Unknown step kind: $kind"
      exit_code=1
      ;;
  esac

  if [[ $exit_code -eq 0 && -z "$error" ]]; then
    complete_step "$step_id" "$output"
    log "✅ Step $step_id completed"
  else
    fail_step "$step_id" "$error"
    log "❌ Step $step_id failed: $error"
  fi

  log_action "$step_id" "$output" "$error" "$started_at"
}

# Stub implementations (replace with real logic)
analyze_data() {
  local params=$1
  echo "Analyzed: $params"
}

crawl_web() {
  local params=$1
  echo "Crawled: $params"
}

write_content() {
  local params=$1
  echo "Wrote content: $params"
}

draft_tweet() {
  local params=$1
  echo "Drafted tweet: $params"
}

post_tweet() {
  local params=$1
  # Check if autopost is enabled
  local autopost=$(curl -s -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" \
    "$SUPABASE_URL/rest/v1/ops_policy?key=eq.x_autopost&select=value" 2>/dev/null | jq -r '.[0].value.enabled // false')
  
  if [[ "$autopost" == "true" ]]; then
    echo "Posted tweet: $params"
  else
    echo "Tweet drafted (autopost disabled): $params"
  fi
}

review_content() {
  local params=$1
  echo "Reviewed content: $params"
}

# Finalize mission (check if all steps done)
finalize_mission() {
  local mission_id=$1
  
  local steps=$(curl -s -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" \
    "$SUPABASE_URL/rest/v1/ops_mission_steps?mission_id=eq.$mission_id&select=status" 2>/dev/null)
  
  local all_done=$(echo "$steps" | jq '[.[] | select(.status == "succeeded" or .status == "failed")] | length')
  local total=$(echo "$steps" | jq 'length')
  
  if [[ "$all_done" == "$total" ]]; then
    local any_failed=$(echo "$steps" | jq '[.[] | select(.status == "failed")] | length')
    local new_status=$([[ "$any_failed" -gt 0 ]] && echo "failed" || echo "succeeded")
    local completed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    curl -s -X PATCH \
      -H "apikey: $SUPABASE_KEY" \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"status\": \"$new_status\", \"completed_at\": \"$completed_at\"}" \
      "$SUPABASE_URL/rest/v1/ops_missions?id=eq.$mission_id" 2>/dev/null
    
    log "📋 Mission $mission_id finalized: $new_status"
  fi
}

# Poll for work
poll_and_work() {
  # Get oldest queued step
  local step=$(curl -s -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" \
    -G -d "status=eq.queued" -d "order=created_at.asc" -d "limit=1" \
    "$SUPABASE_URL/rest/v1/ops_mission_steps" 2>/dev/null | jq -r '.[0] // empty')

  if [[ -z "$step" || "$step" == "null" ]]; then
    return 0
  fi

  local step_id=$(echo "$step" | jq -r '.id')
  local kind=$(echo "$step" | jq -r '.kind')
  local params=$(echo "$step" | jq -r '.params')
  local mission_id=$(echo "$step" | jq -r '.mission_id')

  # Try to claim it
  local claimed=$(claim_step "$step_id")

  if [[ -n "$claimed" && "$claimed" != "[]" ]]; then
    execute_step "$step_id" "$kind" "$params"
    finalize_mission "$mission_id"
  fi
}

# Main loop
log "🚀 LucyWorkspace Worker starting"
log "Worker ID: $WORKER_ID"
log "Supabase: $SUPABASE_URL"
log "Poll interval: ${POLL_INTERVAL}s"
log ""

while true; do
  if ! poll_and_work; then
    log "⚠️ Error during work cycle"
  fi
  sleep "$POLL_INTERVAL"
done

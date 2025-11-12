#!/bin/bash

# Zero Trust Access Control Verification Script
# Ensures developers only modify files they have permission to change

set -e

echo "🔐 Verifying Zero Trust Access Control..."

# Get the current actor (developer)
ACTOR="${GITHUB_ACTOR:-unknown}"
echo "👤 Checking permissions for: $ACTOR"

# Get changed files
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
    echo "ℹ️  No changed files detected, skipping access control check"
    exit 0
fi

echo "📝 Changed files:"
echo "$CHANGED_FILES"

# Define access control rules
declare -A TEAM_ACCESS=(
    ["frontend-dev"]="client/ shared/types/"
    ["backend-dev"]="server/ shared/schema.ts shared/types/"
    ["database-dev"]="migrations/ shared/schema.ts"
    ["fullstack-dev"]="client/ server/ shared/ migrations/"
    ["team-lead"]="client/ server/ shared/ migrations/ docs/ .github/"
    ["admin"]="*"
)

# Get team membership (would be configured in GitHub Teams)
get_user_teams() {
    local user=$1
    
    # This would query GitHub API in real implementation
    # For now, using simple mapping based on naming convention
    case $user in
        *-frontend-*)
            echo "frontend-dev"
            ;;
        *-backend-*)
            echo "backend-dev"
            ;;
        *-db-*)
            echo "database-dev"
            ;;
        *-lead-*)
            echo "team-lead"
            ;;
        *-admin-*)
            echo "admin"
            ;;
        *)
            echo "frontend-dev"  # Default to most restrictive
            ;;
    esac
}

USER_TEAM=$(get_user_teams "$ACTOR")
echo "👥 User team: $USER_TEAM"

# Get allowed paths for user's team
ALLOWED_PATHS="${TEAM_ACCESS[$USER_TEAM]}"
echo "✅ Allowed paths: $ALLOWED_PATHS"

# Check each changed file against allowed paths
VIOLATIONS=()

while IFS= read -r file; do
    [ -z "$file" ] && continue
    
    ALLOWED=false
    
    # Check if user has admin access (wildcard)
    if [[ "$ALLOWED_PATHS" == "*" ]]; then
        ALLOWED=true
    else
        # Check each allowed path
        for path in $ALLOWED_PATHS; do
            if [[ "$file" == $path* ]]; then
                ALLOWED=true
                break
            fi
        done
    fi
    
    if [ "$ALLOWED" = false ]; then
        VIOLATIONS+=("$file")
        echo "❌ VIOLATION: $file (not in allowed paths)"
    else
        echo "✅ ALLOWED: $file"
    fi
    
done <<< "$CHANGED_FILES"

# Report violations
if [ ${#VIOLATIONS[@]} -gt 0 ]; then
    echo ""
    echo "🚨 ACCESS CONTROL VIOLATIONS DETECTED!"
    echo "❌ The following files were modified without proper permissions:"
    
    for violation in "${VIOLATIONS[@]}"; do
        echo "   - $violation"
    done
    
    echo ""
    echo "📋 Allowed paths for team '$USER_TEAM':"
    for path in $ALLOWED_PATHS; do
        echo "   - $path"
    done
    
    echo ""
    echo "💡 To resolve this:"
    echo "   1. Request permission from team lead"
    echo "   2. Move changes to appropriate module"
    echo "   3. Use integration APIs for cross-module communication"
    
    exit 1
fi

echo ""
echo "✅ All file changes are within allowed access scope"
echo "🔐 Zero Trust access control verification passed!"

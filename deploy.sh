#!/bin/bash

# Set working directory to the script's directory
cd "$(dirname "$0")"

# Check if git user name is set locally or globally
if [ -z "$(git config user.name)" ]; then
    echo "⚠️ Git user.name není nastaven."
    read -p "Zadejte své jméno pro Git commits (např. Petr): " git_name
    if [ -n "$git_name" ]; then
        git config user.name "$git_name"
        echo "✅ Jméno nastaveno na: $git_name"
    else
        echo "❌ Jméno nebylo zadáno. Commit může selhat."
    fi
fi

# Check if git user email is set locally or globally
if [ -z "$(git config user.email)" ]; then
    echo "⚠️ Git user.email není nastaven."
    read -p "Zadejte svůj e-mail pro Git (např. piitrpan.coder@gmail.com): " git_email
    if [ -n "$git_email" ]; then
        git config user.email "$git_email"
        echo "✅ E-mail nastaven na: $git_email"
    else
        echo "❌ E-mail nebyl zadán. Commit může selhat."
    fi
fi

# Stage changes
echo "📦 Přidávám změny..."
git add index.html porto.html sw.js manifest.json generate_icons.py icon-192.png icon-512.png lagos.html hub.html 2>/dev/null || git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "ℹ️ Žádné nové změny k uložení."
else
    # Commit changes
    commit_msg="Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "💾 Ukládám commit: '$commit_msg'..."
    git commit -m "$commit_msg"
fi

# Push to remote repository
echo "🚀 Odesílám změny na GitHub (origin main)..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Úspěšně nahráno a nasazeno na GitHub!"
else
    echo "❌ Chyba při nahrávání na GitHub. Zkontrolujte prosím připojení nebo přihlašovací údaje (Personal Access Token)."
fi

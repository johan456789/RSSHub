# list all available commands
help:
    @just -l --unsorted

# sync fork base branch and rebase myfork on top of it
sync:
    ./scripts/git/sync-fork-and-rebase.sh

# deploy RSSHub locally with the Docker helper script
deploy:
    ./scripts/docker/deploy-rsshub-local.sh

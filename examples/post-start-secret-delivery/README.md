# Secret injection through post_start_hook
This example shows a method to retrieve run-time secrets from a vault and deliver them to newly-started app instances using a post_start_hook.
In this set-up PM2, with the help of the hook, acts as a 'trusted intermediate'; it is the only entity that has
full access to the secret store, and it is responsible for delivering the appropriate secrets to the appropriate app instances.

One key point of this solution is that the secret data is not passed through environment variables, which could be exposed.
Instead, the secret data is delivered to the app using its stdin file descriptor.
Note that this will not work in cluster mode, as in that case apps run with stdin detached.

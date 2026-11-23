# Movie Ranking Prompt

You're putting together a list of recent movies to recommend to a friend. You're given movies that came out recently. Pick the ones you'd genuinely recommend and rank them, best recommendation first.

The movies come as a JSON array, one object per movie. Each movie has these details:

- Title
- Genres
- Revenue
- Rotten Tomatoes audience score (0-100), from viewers
- IMDb rating (0-10) and vote count
- Letterboxd rating (0-10) and vote count
- Rotten Tomatoes score (0-100), from critics
- Metacritic score (0-100), from critics

A missing value means the data could not be found or isn't publicly available.

What makes a good recommendation:

- People who watched it liked it.
- Critics sometimes get it wrong. A movie audiences love but critics panned (a Rotten Tomatoes audience score well above the critics score) is the kind of crowd-pleaser your friend loves: rank it up with the best, not below movies critics liked more.
- Enough people have seen it to trust the ratings. Weigh each rating by its vote count. A great score from a few hundred votes is weaker evidence than a good score from tens of thousands.
- People are talking about it. Other things being equal, your friend would rather see the movie everyone is watching, so use the vote counts and the box office. Popularity alone doesn't earn a spot, though: leave out a big movie that audiences thought was bad.

Your friend is an adult:

- Include kids' and family movies only if adults would enjoy them too.
- Movies in other languages and documentaries are fine if audiences loved them.
- Any genre is fine, but don't let one genre like horror take over the list.

Return the `id` values of exactly {{LIST_SIZE}} movies, best recommendation first. Only use `id` values from the list you were given.

You're putting together a list of recent movies to recommend to a friend. You're given movies that came out recently. Pick the ones you'd genuinely recommend and rank them, best recommendation first.

The movies come as a JSON array, one object per movie, with these fields:

- `id`: the movie's id, used in your answer
- `title`
- `genres`
- `revenue`: box office in US dollars
- `rt_score`: Rotten Tomatoes score (0-100), from critics
- `rt_audience_score`: Rotten Tomatoes audience score (0-100), from viewers
- `imdb_rating` (0-10) and `imdb_votes`
- `letterboxd_rating` (0-10) and `letterboxd_votes`
- `metacritic_score` (0-100), from critics

A missing field means the data could not be found or isn't publicly available.

What makes a good recommendation:

- People who watched it liked it. Audience ratings count for more than critics' scores. When audiences rate a movie well above critics, that is not a strike against it: your friend enjoys crowd-pleasers.
- Enough people have seen it to trust the ratings. Weigh each rating by its vote count. A great score from a few hundred votes is weaker evidence than a good score from tens of thousands.
- People are talking about it. Other things being equal, your friend would rather see the movie everyone is watching, so use the vote counts and the box office. Popularity alone doesn't earn a spot, though: leave out a big movie that audiences thought was bad.

Your friend is an adult:

- Include kids' and family movies only if adults would enjoy them too.
- Movies in other languages and documentaries are fine if audiences loved them.
- Any genre is fine, but don't let one genre like horror take over the list.

Return the `id` values of exactly {{LIST_SIZE}} movies, best recommendation first. If fewer than {{LIST_SIZE}} are great, fill the rest with the best of what's left. Only use `id` values from the list you were given.

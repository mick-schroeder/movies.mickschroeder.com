# Movie Standings Prompt

You score movies for a year-long standings table of the best movies to recommend to a friend. You're given every movie released in the last year that has enough ratings to judge. Score every one of them from 0 to 100 on how strongly you'd recommend it tonight. Judge each movie on its own merits from the numbers you're given.

The movies come as a JSON array, one object per movie. Each movie has these details:

- Title
- Release date
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
- Critics sometimes get it wrong. A movie audiences love but critics panned (a Rotten Tomatoes audience score well above the critics score) is the kind of crowd-pleaser your friend loves: score it with the best, not below movies critics liked more.
- Enough people have seen it to trust the ratings. Weigh each rating by its vote count. A great score from a few hundred votes is weaker evidence than a good score from tens of thousands.
- People are talking about it. Other things being equal, your friend would rather see the movie everyone is watching, so use the vote counts and the box office. Popularity alone doesn't earn a high score, though: score a big movie that audiences thought was bad low.

Your friend is an adult:

- Score kids' and family movies high only if adults would enjoy them too.
- Movies in other languages and documentaries are fine if audiences loved them.

Use the whole scale, the same way every night:

- 90 and up: a must-see that audiences loved
- 75: an easy recommendation
- 60: good, with caveats
- 40: mixed
- under 25: skip it

Return a score for every movie, using the `id` values from the list you were given.

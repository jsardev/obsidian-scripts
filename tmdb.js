const TMDB_API_KEY_OPTION = "TMDB_API_KEY";
const BASE_URL = "https://api.themoviedb.org";

const SearchType = {
  MOVIE: "movie",
  TV_SERIES: "tv",
};

let _quickAdd;
let _settings;

const run = async (quickAdd, settings) => {
  _quickAdd = quickAdd.quickAddApi;
  _settings = settings;

  const name = await _quickAdd.inputPrompt("Enter movie / tv series name");

  const response = await searchByNameAndType(name, _settings.type);

  const choice = await _quickAdd.suggester(
    (item) => mapSearchResultToSuggestion(item, _settings.type),
    response.results
  );

  const details = await queryDetailsByIdAndType(choice.id, _settings.type);

  quickAdd.variables = await createVariablesByType(details, _settings.type);
};

const searchByNameAndType = async (name, type) => {
  const url = new URL(`${BASE_URL}/3/search/${type}`);
  url.searchParams.append("query", name);
  url.searchParams.append("api_key", _settings[TMDB_API_KEY_OPTION]);

  const response = await request(url.href);

  return JSON.parse(response);
};

const queryDetailsByIdAndType = async (id, type) => {
  const url = new URL(`${BASE_URL}/3/${type}/${id}`);
  url.searchParams.append("api_key", _settings[TMDB_API_KEY_OPTION]);

  const response = await request(url.href);

  return JSON.parse(response);
};

const createVariablesByType = async (data, type) => {
  const commonVariables = {
    genres: createGenresVariable(data.genres),
    language: data.original_language,
  };

  switch (type) {
    case SearchType.MOVIE:
      return {
        ...commonVariables,
        ...(await createMovieVariables(data)),
      };
    case SearchType.TV_SERIES:
      return {
        ...commonVariables,
        ...(await createTvSeriesVariables(data)),
      };
  }
};

const createPosterVariable = (posterPath) =>
  `https://image.tmdb.org/t/p/original${posterPath}`;

const createGenresVariable = (genres) =>
  genres.map((genre) => genre.name.toLowerCase()).join(", ");

const createMovieVariables = async (data) => {
  return {
    title: data.title.toLowerCase(),
    release_date: data.release_date,
    tmdb_rating: data.vote_average,
    tmdb_poster: createPosterVariable(data.poster_path),
    tmdb_link: `https://www.themoviedb.org/movie/${data.id}`,
  };
};

const createTvSeriesVariables = async (data) => {
  const { season_number, air_date, episode_count, vote_average, poster_path } =
    await _quickAdd.suggester(
      (item) => item.name,
      createSeasonSuggestions(data)
    );

  if (season_number) {
    return {
      title: `${data.name.toLowerCase()} season ${season_number}`,
      air_date: air_date,
      season: season_number,
      number_of_episodes: episode_count,
      number_of_seasons: "n/a",
      tmdb_rating: vote_average,
      tmdb_poster: createPosterVariable(poster_path),
      tmdb_link: `https://www.themoviedb.org/tv/${data.id}/season/${season_number}`,
    };
  }

  return {
    title: `${data.name.toLowerCase()}`,
    air_date: data.first_air_date,
    season: "all",
    number_of_episodes: data.number_of_episodes,
    number_of_seasons: data.number_of_seasons,
    tmdb_rating: data.vote_average,
    tmdb_poster: createPosterVariable(data.poster_path),
    tmdb_link: `https://www.themoviedb.org/tv/${data.id}`,
  };
};

const createSeasonSuggestions = (data) => {
  return [
    { name: "All", season_number: null, vote_average: data.vote_average },
    ...data.seasons,
  ];
};

const mapSearchResultToSuggestion = (item, type) => {
  switch (type) {
    case SearchType.TV_SERIES:
      return `${item.name} (${item.original_language}, ${item.first_air_date})`;
    case SearchType.MOVIE:
      return `${item.title} (${item.original_language}, ${item.release_date})`;
  }
};

module.exports = {
  entry: run,
  settings: {
    name: "tmdb",
    author: "Jakub Sarnowski",
    options: {
      [TMDB_API_KEY_OPTION]: {
        type: "text",
      },
      type: {
        type: "dropdown",
        options: Object.values(SearchType),
      },
    },
  },
};

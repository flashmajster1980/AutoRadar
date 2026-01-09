const { extractMakeModel } = require('./scoring_agent');
const title = "BMW Rad 2 Gran Tourer 218d Standard A/T";
const result = extractMakeModel(title);
console.log(result);

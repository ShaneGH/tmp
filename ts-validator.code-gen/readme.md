# Steps

1. transform: get variables that will be validated (+ rewrite actual files)
2. expressionTypeResolver: take the variable and get a node which represent's its type
3. convertType: convert node which represents type into Type
4. generateValidateFile: write types to file
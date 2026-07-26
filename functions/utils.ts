export function logger(
    str: string,
    color: string | undefined = undefined,
    type: string | undefined = undefined
): void {
    switch (color) {
        case "red":
            str = `\x1b[31m${str}`;
            break;
        case "green":
            str = `\x1b[32m${str}`;
            break;
        case "yellow":
            str = `\x1b[33m${str}`;
            break;
        case "blue":
            str = `\x1b[34m${str}`;
            break;
        case "magenta":
            str = `\x1b[35m${str}`;
            break;
        case "cyan":
            str = `\x1b[36m${str}`;
            break;
        case "white":
            str = `\x1b[37m${str}`;
            break;
        default:
            str = str;
    }
    switch (type) {
        case "bold":
            str = `\u001b[1m${str}`;
            break;
        case "underline":
            str = `\u001b[4m${str}`;
            break;
        case "inverse":
            str = `\u001b[7m${str}`;
            break;
        case "strikethrough":
            str = `\u001b[9m${str}`;
            break;
        default:
            str = str;
    }
    str += "\x1b[0m";
    console.log(str);
    return;
}

export type vehicle = {
    Make_ID: number
    Make_Name: string
    Model_ID: number
    Model_Name: string
}

export async function getModelsArrayForMake(make: string): Promise<string[]> {
    return await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${make}?format=json`)
        .then(res => res.json())
        .then(result => result.Results) // only return the Results array, not the entire object
        .catch(err => console.error(err));
}

export async function getModelsForMakeId(makeId: number): Promise<vehicle[]> {
    return await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/${makeId}?format=json`)
        .then(res => res.json())
        .then(result => result.Results)
        .catch(err => console.error(err));
}

export function getModelForModelsAndModelId(models: vehicle[], modelId: number): vehicle | undefined {
    return models.find((model: vehicle) => model.Model_ID === modelId);
}
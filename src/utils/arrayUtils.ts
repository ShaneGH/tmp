

function compareArrays<T>(arr1: T[], arr2: T[]) {
    if (!arr1 && !arr2) return true;
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;

    for (var i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }

    return true;
}

export {
    compareArrays
}
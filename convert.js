const fs = require('fs');
const glob = require('glob');
const parseXML = require('xml2js').parseString;

const inputDir = process.argv[2];
const outputFile = process.argv[3];

if (inputDir && outputFile) {

    glob(inputDir + '/*.xml', {}, (error, files) => {
        if (!error) {
            console.log(`Converting ${files.length} Alloy XML files.`);
            Promise
                .all(files.map(parseAlloyFileAsync))
                .then(graphs => {
                    fs.writeFile(outputFile, JSON.stringify(graphs, null, 2), err => {
                        if (!err)
                            console.log(`Graph data saved to ${outputFile}`)
                        else
                            console.error(err);
                    })
                })
        } else {
            console.error(error);
        }
    })

} else {
    printUsage();
}

function alloyToGraph (alloy) {

    const instance = alloy.alloy.instance[0];

    const fields = instance.field;
    const sigs = instance.sig;
    const skolem = instance.skolem;

    const nodes = [];
    const edges = [];
    const parents = {};
    const types = {};

    // Parse signatures to build nodes and type tree
    sigs.forEach(sig => {

        const label = sig.$.label;
        const id = sig.$.ID;
        const parent = sig.$.parentID;

        if (id && label) {
            const isSubset = sig.type !== undefined;
            if (!isSubset) {
                types[id] = label;
                if (parent) parents[id] = parent;
                const atoms = sig.atom ? sig.atom.map(atom => {
                    return {
                        id: atom.$.label,
                        type: [id]
                    };
                }) : [];
                nodes.push(...atoms);
            }
        } else {
            console.error(`ERROR: Signature has no ID or label`);
        }
    });

    // Add types to nodes
    nodes.forEach(node => {
        let type = node.type[0];
        while ((type = parents[type]) !== undefined) {
            node.type.push(type);
        }
        node.type = node.type.map(t => types[t]);
    })

    fields.forEach(field => {
        const label = field.$.label;
        const tuples = field.tuple;
        if (tuples) {
            tuples.forEach(tuple => {
                const atoms = tuple.atom.map(atom => {
                    return atom.$.label;
                });
                edges.push({
                    source: atoms[0],
                    target: atoms[1],
                    field: label
                });
            });
        }
    });

    skolem.forEach(skolem => {
        const label = skolem.$.label;
        const tuples = skolem.tuple;
        if (tuples) {
            tuples.forEach(tuple => {
                const atoms = tuple.atom.map(atom => {
                    return atom.$.label;
                });
                edges.push({
                    source: atoms[0],
                    target: atoms[1],
                    field: label
                });
            })
        }
    });

    return {
        nodes,
        edges: edges
    };
}

function parseAlloyFileAsync (file) {
    return new Promise((resolve, reject) => {
        fs.readFile(file, 'utf8', (err, data) => {
            if (err) {
                console.error(err);
                reject(err)
            } else {
                parseXML(data, (err, res) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        const graph = alloyToGraph(res);
                        resolve(graph);
                    }
                });
            }
        })
    })
}

function printUsage () {
    console.log('node convert.js [xml directory] [output JSON file]');
}
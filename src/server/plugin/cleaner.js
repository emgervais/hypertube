import fs from 'fs'

export default async function cleanup(db) {
    const limit = 30 * 24 * 60 * 60 * 1000; //days - hour - min - sec - ms
    try {
        const collection = db.collection('movies');
        const expired = await collection.find({$expr: {$lt: [  { $add: ["$lastSeen", limit] },  Date.now()]}}).toArray();
        if(!expired)
            return;
        console.log("Deleted: ", expired);
        for (const movie of expired) {
            const folder = movie.bitBody.file.split('/').slice(0,-1).join('/');
            try {
                fs.rmSync(folder, { recursive: true, force: true });
            } catch (err) {
                console.error(`Failed to remove folder ${folder}:`, err);
            }
            collection.findOneAndDelete({ _id: movie._id });
        }
    } catch(e) {
        console.log(e); 
    }
}
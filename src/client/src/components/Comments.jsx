import { useEffect, useState } from "react"
import { useFetchWithAuth } from '../utils/fetchProtected.js'

export default function Comments({id}) {
    const fetchWithAuth = useFetchWithAuth();
    const [comments, setComments] = useState([]);

    const fetchComments = async () => {
        const res = await fetch(`http://127.0.0.1:8080/api/movieComments/${id}`)
        const commentsList = await res.json();
        setComments(commentsList);
    }
    useEffect(() => {
        fetchComments();
    }, [])
    const sendComment = async (event) => {
        event.preventDefault();
        const comment = event.target.sendComments.value;
        const res = await fetchWithAuth(`/api/addComments`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({comment: comment, movie_id: id})
        });
        if(!res.ok)
            return;
        fetchComments();
        event.target.reset();
    }
    return (
        <div className="bg-red w-full h-1/4">
            <div className="flex flex-col-reverse max-h-full overflow-y-scroll">
            {comments.map((comment) => {
                return (<div key={comment._id} className="">
                    <p className="text-left">{comment.username + ': ' + comment.comment}</p>
                </div>);
            })}
            </div>
            <form className='flex' onSubmit={sendComment}>
                <input className='border-solid border-1 border-inherit rounded-md text-center mr-2 w-3/4 wrap' id="sendComments" name="sendComments" type="sendComments" required autoComplete="sendComments"></input>
                <button type="submit" className="flex w-1/4 justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"> Send </button>
            </form>
        </div>
    );
}
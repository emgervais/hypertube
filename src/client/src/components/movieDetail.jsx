import { Star } from '../assets/icon.jsx';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

export default function MovieDetail() {
    const location = useLocation();
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoSrc, setVideoSrc] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const retryTimeoutRef = useRef(null);
    const streamUrl = `http://localhost:8080/stream?id=${location.state.movie.id}`;

    const checkStreamAvailability = async () => {
        setStatusMessage('Checking stream availability...');
        try {
            // Use HEAD request to check headers without downloading the body
            const response = await fetch(streamUrl, { method: 'HEAD' });

            if (response.ok || response.status === 206) { // 200 OK or 206 Partial Content
                setStatusMessage('');
                setVideoSrc(streamUrl); // Set the source URL for the video tag
            } else if (response.status === 503) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
                setStatusMessage(`Download initializing, retrying in ${retryAfter} seconds...`);
                retryTimeoutRef.current = setTimeout(checkStreamAvailability, retryAfter * 1000);
            } else {
                setStatusMessage(`Error: ${response.status} ${response.statusText}`);
                setIsPlaying(false); // Stop trying if it's another error
            }
        } catch (error) {
            console.error('Error checking stream availability:', error);
            setStatusMessage('Error checking stream. Please try again later.');
            setIsPlaying(false); // Stop trying on network errors
        }
    };

    useEffect(() => {
        // Clear any pending timeouts when the component unmounts or isPlaying changes
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (isPlaying) {
            setVideoSrc(null); // Reset video source
            checkStreamAvailability();
        } else {
            // Clear timeout and reset state if user stops playback manually
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
            setVideoSrc(null);
            setStatusMessage('');
        }
        // Dependency array includes isPlaying to trigger effect when it changes
        // and streamUrl in case the id changes somehow (though unlikely with useLocation)
    }, [isPlaying, streamUrl]);


    const handlePlayClick = () => {
        setIsPlaying(!isPlaying);
    };

    return (
        <div className='flex flex-col justify-center grow-5 items-center'>
            <div className='size-1/2 flex flex-col justify-center align-center h-fit'>
                <h4 className='font-bold pb-2 text-center'>{location.state.movie.title}<div className='flex justify-center items-center'>{`(${location.state.movie.year}) `}{location.state.movie.rating}<Star/></div></h4>
                {isPlaying ? (
                    videoSrc ? (
                        <video src={videoSrc} width="1080px" controls autoPlay crossOrigin="anonymous" onError={(e) => {
                            // Basic error handling for the video element itself
                            console.error('Video element error:', e);
                            setStatusMessage('Error playing video.');
                            setVideoSrc(null); // Clear src on error
                            setIsPlaying(false); // Stop playback state
                        }}></video>
                    ) : (
                        <div className='flex justify-center items-center aspect-video bg-gray-800 text-white'>
                            {statusMessage || 'Loading...'}
                        </div>
                    )
                ) : (
                    <img src={location.state.movie.image} alt={location.state.movie.title} />
                )}
            </div>
            <button onClick={handlePlayClick} className='mt-4 p-2 bg-blue-500 text-white rounded'>
                {isPlaying ? 'Stop' : 'Play'}
            </button>
            {isPlaying && !videoSrc && statusMessage && <p className="text-sm text-gray-400 mt-2">{statusMessage}</p>}
        </div>
    )
}
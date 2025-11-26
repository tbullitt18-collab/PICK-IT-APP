import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  deleteDoc,
  onSnapshot, 
  query, 
  where,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  MapPin, 
  Copy, 
  Utensils, 
  Star, 
  Flame, 
  Check, 
  Users,
  ArrowRight,
  RefreshCw,
  Trophy,
  AlertCircle
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* FIREBASE SETUP & ENV VARS                                                  */
/* -------------------------------------------------------------------------- */

let firebaseConfig;
let yelpApiKey;

// 1. PREVIEW ENVIRONMENT (Works in this editor)
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
  yelpApiKey = ""; // No Yelp key in preview
} else {
   2. PRODUCTION ENVIRONMENT (Render / Vite)
     
     IMPORTANT: When deploying to Render, UNCOMMENT the block below!
     This allows the app to read your environment variables.
  

   UNCOMMENT FOR PRODUCTION:
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
  
  // Add this variable in Render Dashboard as VITE_YELP_API_KEY
  yelpApiKey = import.meta.env.VITE_YELP_API_KEY;
  

  if (!firebaseConfig) {
     console.warn("Using placeholder config for development");
     firebaseConfig = { apiKey: "dev-placeholder" };
  }
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'pickit-prod';

/* -------------------------------------------------------------------------- */
/* MOCK DATA (Fallback)                                                       */
/* -------------------------------------------------------------------------- */

const MOCK_RESTAURANTS = [
  {
    id: 'r1',
    name: "Che Butter Jonez (Mock)",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
    rating: 4.8,
    reviewCount: 342,
    price: "$$",
    cuisine: "Halal, Burgers, Seafood",
    address: "1602 Lavista Rd NE, Atlanta, GA 30329"
  },
  {
    id: 'r2',
    name: "NFA Burger - Dunwoody",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
    rating: 4.6,
    reviewCount: 890,
    price: "$$",
    cuisine: "Burgers, American",
    address: "5465 Chamblee Dunwoody Rd, Dunwoody, GA 30338"
  },
  {
    id: 'r3',
    name: "Wheelhouse Craft Pub",
    image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80",
    rating: 4.5,
    reviewCount: 210,
    price: "$$",
    cuisine: "Pubs, Fish & Chips, Burgers",
    address: "1479 Scott Blvd, Decatur, GA 30030"
  },
  {
    id: 'r4',
    name: "Atlanta Breakfast Club",
    image: "https://images.unsplash.com/photo-1533089862017-ecc323f5194b?auto=format&fit=crop&w=800&q=80",
    rating: 4.5,
    reviewCount: 3500,
    price: "$$",
    cuisine: "Southern, Breakfast & Brunch",
    address: "249 Ivan Allen Jr Blvd, Atlanta, GA 30313"
  },
  {
    id: 'r5',
    name: "Whiskey Bird",
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80",
    rating: 4.4,
    reviewCount: 520,
    price: "$$",
    cuisine: "Asian Fusion, Yakitori",
    address: "1409 North Highland Ave NE, Atlanta, GA 30306"
  }
];

/* -------------------------------------------------------------------------- */
/* YELP API UTILS                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Fetches restaurants from Yelp using a CORS proxy.
 * Warning: Client-side calls to Yelp require a proxy. 
 * Using 'cors-anywhere' for demo purposes.
 */
const fetchYelpRestaurants = async (location, term) => {
  if (!yelpApiKey) {
    console.warn("Yelp API Key missing. Falling back to mock data.");
    return null;
  }

  // Using cors-anywhere demo proxy. In production, use your own backend.
  const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";
  const YELP_ENDPOINT = "https://api.yelp.com/v3/businesses/search";
  
  // Combine all preferences into a search term
  const searchParams = new URLSearchParams({
    location: location,
    term: term || "restaurants",
    limit: 10,
    sort_by: "best_match"
  });

  try {
    const response = await fetch(`${CORS_PROXY}${YELP_ENDPOINT}?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${yelpApiKey}`,
        "X-Requested-With": "XMLHttpRequest" // Required by cors-anywhere
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
         console.error("CORS Proxy Error: You might need to visit https://cors-anywhere.herokuapp.com/corsdemo to enable temporary access.");
      }
      throw new Error(`Yelp API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Map Yelp data to our app's format
    return data.businesses.map(b => ({
      id: b.id,
      name: b.name,
      image: b.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=60",
      rating: b.rating,
      reviewCount: b.review_count,
      price: b.price || "$$",
      cuisine: b.categories?.[0]?.title || "Restaurant",
      address: b.location?.address1 || b.location?.city
    }));

  } catch (error) {
    console.error("Failed to fetch from Yelp:", error);
    return null; // Triggers fallback
  }
};

/* -------------------------------------------------------------------------- */
/* UTILS                                       */
/* -------------------------------------------------------------------------- */

const generateSessionId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const triggerConfetti = () => {
  const colors = ['#a855f7', '#ec4899', '#3b82f6', '#fbbf24'];
  for (let i = 0; i < 150; i++) {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = '-10px';
    el.style.width = Math.random() * 10 + 5 + 'px';
    el.style.height = Math.random() * 10 + 5 + 'px';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);

    const animation = el.animate([
      { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${Math.random() * 200 - 100}px, 100vh) rotate(${Math.random() * 720}deg)`, opacity: 0 }
    ], {
      duration: Math.random() * 2000 + 1500,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    });

    animation.onfinish = () => el.remove();
  }
};

/* -------------------------------------------------------------------------- */
/* COMPONENTS                                  */
/* -------------------------------------------------------------------------- */

function Landing({ onStart }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return;
    setIsCreating(true);
    onStart(name, location);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center text-white">
      <div className="mb-6 animate-bounce">
        <Utensils size={64} className="text-white drop-shadow-md" />
      </div>
      <h1 className="text-6xl font-extrabold mb-2 tracking-tight drop-shadow-sm">PickIt</h1>
      <p className="text-xl text-purple-100 font-medium mb-12 drop-shadow-sm">Stop arguing. Start eating.</p>

      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-gray-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Start a New Decision</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-lg placeholder-gray-400 font-medium"
              required
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Location (e.g., Atlanta, GA)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-lg placeholder-gray-400 font-medium"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transform transition-all disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-lg"
          >
            {isCreating ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <>Create Session <ArrowRight size={20} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function JoinSession({ onJoin, sessionId }) {
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsJoining(true);
    onJoin(name, sessionId);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center text-white">
       <div className="mb-8">
        <Utensils size={64} className="text-white opacity-90" />
      </div>
      <h1 className="text-5xl font-extrabold mb-8 drop-shadow-sm">Join the Decision</h1>
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-gray-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 to-orange-500"></div>
        <p className="text-gray-500 mb-8 text-sm font-medium">Session ID: <span className="font-mono font-bold text-lg text-purple-600 bg-purple-100 px-3 py-1 rounded ml-2">{sessionId}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-lg font-medium"
            required
          />
          <button
            type="submit"
            disabled={isJoining}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transform transition-all text-lg"
          >
            {isJoining ? 'Joining...' : 'Join Session'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Lobby({ session, participants, userId, onSubmitPref, onStartVoting, isStarting }) {
  const [craving, setCraving] = useState('');
  const [copied, setCopied] = useState(false);
  const userParticipant = participants.find(p => p.userId === userId);
  const isHost = session.hostId === userId;
  const hasSubmitted = !!userParticipant?.preference;

  const handleCopy = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    const textArea = document.createElement("textarea");
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {}
    document.body.removeChild(textArea);

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (craving.trim()) {
      onSubmitPref(craving);
      setCraving('');
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 pb-32 text-gray-800 bg-gray-50 min-h-screen shadow-2xl">
      <div className="bg-white rounded-3xl p-8 shadow-sm mb-6 text-center border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div className="flex justify-center mb-2">
            <div className="bg-purple-100 p-3 rounded-full">
                <Utensils className="text-purple-600" size={24} />
            </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">PickIt Session</h2>
        <p className="text-sm text-gray-500 mb-6">{session.location}</p>
        
        <div className="bg-slate-50 rounded-2xl p-6 mb-6 border border-slate-100">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Session ID</p>
          <p className="text-4xl font-mono font-black text-slate-800 tracking-wider mb-4">{session.id}</p>
          
           <div className="flex flex-col gap-3">
             <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-400 truncate font-mono">
               {window.location.href}
             </div>
             <button
              onClick={handleCopy}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all shadow-md flex justify-center items-center gap-2 ${
                copied ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
              }`}
            >
              {copied ? <Check size={16}/> : <Copy size={16}/>}
              {copied ? 'Link Copied!' : 'Copy Invite Link'}
            </button>
           </div>
        </div>
        
        <p className="text-xs text-gray-400 font-medium">Share with your group so everyone can submit preferences!</p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm mb-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="text-orange-500 fill-orange-500" size={20} />
          <h3 className="text-xl font-bold text-gray-900">What are you craving?</h3>
        </div>
        
        {!hasSubmitted ? (
          <form onSubmit={handleSubmit}>
            <textarea
              value={craving}
              onChange={(e) => setCraving(e.target.value)}
              placeholder="Describe what you want... (e.g., burgers and live music under $30)"
              className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all resize-none h-32 mb-4 text-base placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={!craving.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all"
            >
              Submit My Preferences
            </button>
          </form>
        ) : (
          <div className="text-center py-8 bg-green-50 rounded-2xl border border-green-100">
             <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
               <Check className="text-green-600" size={28} strokeWidth={3} />
             </div>
             <p className="font-bold text-green-900 text-lg mb-1">Preferences Submitted!</p>
             <p className="text-green-700 text-sm mb-6 px-4">"{userParticipant.preference}"</p>
             <button 
                onClick={() => onSubmitPref('')}
                className="text-sm font-bold text-gray-400 hover:text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
             >
               Edit Response
             </button>
          </div>
        )}
      </div>

      <div className="mb-24">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 pl-2">
          Participants ({participants.length})
        </h3>
        <div className="space-y-3">
          {participants.map(p => (
            <div key={p.userId} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${p.preference ? 'bg-gradient-to-br from-purple-100 to-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <p className="font-bold text-gray-900 leading-tight">{p.name} {p.userId === userId && <span className="text-purple-500 text-xs ml-1">(You)</span>}</p>
                  {p.preference ? (
                     <p className="text-xs text-gray-500 truncate max-w-[180px] mt-0.5">{p.preference}</p>
                  ) : (
                     <p className="text-xs text-gray-400 italic mt-0.5">Typing...</p>
                  )}
                </div>
              </div>
              {p.preference ? (
                <div className="bg-green-100 p-1 rounded-full">
                    <Check size={14} className="text-green-600" strokeWidth={3} />
                </div>
              ) : (
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-lg border-t border-gray-200 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-20">
          <div className="max-w-lg mx-auto">
             <button
              onClick={onStartVoting}
              disabled={participants.length < 1 || isStarting}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex justify-center items-center gap-2 text-lg"
            >
              {isStarting ? (
                <>Finding Restaurants... <RefreshCw className="animate-spin" /></>
              ) : (
                <>Start Voting Phase <ArrowRight size={20} /></>
              )}
            </button>
          </div>
        </div>
      )}
      {!isHost && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 text-center text-gray-500 text-sm font-medium z-20">
          Waiting for host to start voting...
        </div>
      )}
    </div>
  );
}

function Voting({ session, candidates, userId, onVote, votes }) {
  const voteCounts = useMemo(() => {
    const counts = {};
    votes.forEach(v => {
      counts[v.restaurantId] = (counts[v.restaurantId] || 0) + 1;
    });
    return counts;
  }, [votes]);

  const maxVotes = Math.max(...Object.values(voteCounts), 0);
  const myVotes = votes.filter(v => v.userId === userId).map(v => v.restaurantId);

  return (
    <div className="w-full max-w-lg mx-auto p-4 pb-32 text-gray-800 bg-gray-50 min-h-screen shadow-2xl">
       <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl px-4 py-4 -mx-4 mb-6 border-b border-gray-200 shadow-sm">
         <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                Vote Now
              </h2>
              <p className="text-sm font-medium text-gray-500">Tap to vote for your favorites!</p>
            </div>
            <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold shadow-sm border border-indigo-200">
              {votes.length} vote{votes.length !== 1 && 's'} cast
            </div>
         </div>
       </div>

       <div className="space-y-6">
         {candidates.map(restaurant => {
           const count = voteCounts[restaurant.id] || 0;
           const isLeading = count > 0 && count === maxVotes;
           const voted = myVotes.includes(restaurant.id);

           return (
             <div 
                key={restaurant.id}
                onClick={() => onVote(restaurant.id)}
                className={`relative bg-white rounded-3xl shadow-sm border-2 overflow-hidden cursor-pointer transition-all duration-300 group ${
                  voted ? 'border-indigo-500 shadow-indigo-100 shadow-xl scale-[1.02]' : 'border-transparent hover:border-gray-200 hover:shadow-md'
                }`}
             >
               <div className="h-48 w-full relative overflow-hidden">
                 <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                 
                 {/* Leading Badge */}
                 {isLeading && (
                   <div className="absolute top-4 left-4 z-10">
                      <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
                        <Flame size={12} fill="currentColor" /> LEADING
                      </span>
                   </div>
                 )}

                 {/* Voted Overlay */}
                 <div className={`absolute inset-0 bg-indigo-900/40 flex items-center justify-center backdrop-blur-[2px] transition-opacity duration-300 ${voted ? 'opacity-100' : 'opacity-0'}`}>
                   <div className="bg-white text-indigo-600 px-6 py-2.5 rounded-full font-bold shadow-xl flex items-center gap-2 transform scale-110">
                     <Check size={20} strokeWidth={3} /> Voted
                   </div>
                 </div>
               </div>
               
               <div className="p-5">
                 <div className="flex justify-between items-start mb-1">
                   <h3 className="font-bold text-xl text-gray-900 leading-tight">{restaurant.name}</h3>
                   <div className="flex items-center gap-1 bg-yellow-400 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                     <Star size={12} fill="currentColor" /> {restaurant.rating}
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 font-medium">
                   <span className="text-green-600">{restaurant.price}</span>
                   <span className="text-gray-300">•</span>
                   <span className="truncate">{restaurant.cuisine}</span>
                 </div>

                 <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                   <MapPin size={14} className="flex-shrink-0" />
                   <span className="truncate">{restaurant.address}</span>
                 </div>
                 
                 {/* Vote Progress Bar */}
                 <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                        style={{ width: `${(count / (votes.length || 1)) * 100}%` }}
                    ></div>
                 </div>
                 <div className="mt-2 flex justify-end">
                    <span className="text-xs font-bold text-gray-400">{count} vote{count !== 1 && 's'}</span>
                 </div>
               </div>
             </div>
           );
         })}
       </div>
    </div>
  );
}

function Winner({ winner, onReset }) {
  useEffect(() => {
    triggerConfetti();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-10 text-center text-white bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      
      <div className="relative z-10 w-full max-w-md animate-[fadeIn_1s_ease-out]">
        <div className="animate-[bounce_2s_infinite] mb-6 inline-block">
          <div className="relative">
             <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-50 rounded-full"></div>
             <Trophy size={80} className="text-yellow-400 drop-shadow-2xl relative z-10" />
          </div>
        </div>
        <h1 className="text-5xl font-black mb-10 text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-white to-yellow-200 drop-shadow-sm">
          We have a winner!
        </h1>

        <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl transform rotate-1 hover:rotate-0 transition-transform duration-500 text-gray-800 mb-8 mx-4">
          <div className="h-72 relative">
             <img src={winner.image} alt={winner.name} className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
             <div className="absolute bottom-0 inset-x-0 p-8 text-left">
                <h2 className="text-4xl font-bold text-white mb-2 leading-none">{winner.name}</h2>
                <div className="flex items-center gap-3 text-white/90 text-sm font-medium">
                   <span className="bg-yellow-500 text-white px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">
                     <Star size={10} fill="currentColor" /> {winner.rating}
                   </span>
                   <span>•</span>
                   <span>{winner.cuisine}</span>
                   <span>•</span>
                   <span className="text-green-400">{winner.price}</span>
                </div>
             </div>
          </div>
          <div className="p-8 text-left bg-white">
            <div className="flex items-start gap-4 mb-8">
              <div className="bg-purple-100 p-3 rounded-full">
                <MapPin className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Address</p>
                <p className="text-gray-500 leading-relaxed">{winner.address}</p>
              </div>
            </div>
            
            <a 
              href={`https://www.google.com/search?q=${encodeURIComponent(winner.name + ' ' + winner.address)}`} 
              target="_blank"
              rel="noreferrer"
              className="block w-full bg-gray-900 text-white text-center font-bold py-4 rounded-xl hover:bg-black hover:scale-[1.02] transition-all mb-4 shadow-lg text-lg"
            >
              View on Google Maps
            </a>
            <button 
              onClick={onReset}
              className="block w-full bg-purple-50 text-purple-600 text-center font-bold py-4 rounded-xl hover:bg-purple-100 transition-colors"
            >
              Start New Decision
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner({ message, isMock }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-center px-4">
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 border-[6px] border-gray-100 rounded-full"></div>
        <div className="absolute inset-0 border-[6px] border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
             <Utensils className="text-indigo-600 animate-pulse" size={40} />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-gray-800 animate-pulse">{message}</h2>
      <p className="text-gray-400 mt-2">Consulting the hive mind...</p>
      {isMock && (
         <div className="mt-8 p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-sm max-w-sm flex items-start gap-2 text-left">
            <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
            <p>Using <strong>Demo Data</strong>. Add a Yelp API Key in Render environment variables to see real results!</p>
         </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN APP                                    */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  // 1. Auth & Initial Route Check
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) {
      setSessionId(sid);
      setView('join');
    }

    return () => unsubscribe();
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!sessionId || !user) return;

    const unsubSession = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSessionData({ id: sessionId, ...data });
        
        if (data.status === 'voting' && view !== 'voting') {
          setView('voting');
        } else if (data.status === 'finished' && view !== 'winner') {
          setView('winner');
        }
      }
    }, (err) => console.error(err));

    const qParticipants = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'participants'),
      where('sessionId', '==', sessionId)
    );
    const unsubParticipants = onSnapshot(qParticipants, (snap) => {
      const parts = snap.docs.map(d => d.data());
      setParticipants(parts);
    }, (err) => console.error(err));

    const qVotes = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'votes'),
      where('sessionId', '==', sessionId)
    );
    const unsubVotes = onSnapshot(qVotes, (snap) => {
      const v = snap.docs.map(d => d.data());
      setVotes(v);
    }, (err) => console.error(err));

    return () => {
      unsubSession();
      unsubParticipants();
      unsubVotes();
    };
  }, [sessionId, user, view]);

  // 3. Actions
  const createSession = async (hostName, location) => {
    if (!user) return;
    const newSessionId = generateSessionId();
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', newSessionId), {
      hostId: user.uid,
      location: location,
      status: 'open',
      createdAt: serverTimestamp(),
      candidates: []
    });

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', `${newSessionId}_${user.uid}`), {
      sessionId: newSessionId,
      userId: user.uid,
      name: hostName,
      preference: '',
      isHost: true
    });

    setSessionId(newSessionId);
    setView('lobby');
    
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?session=' + newSessionId;
    window.history.pushState({path:newUrl},'',newUrl);
  };

  const joinSession = async (participantName, sid) => {
    if (!user) return;
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', `${sid}_${user.uid}`), {
      sessionId: sid,
      userId: user.uid,
      name: participantName,
      preference: '',
      isHost: false
    });

    setView('lobby');
  };

  const submitPreference = async (prefText) => {
    if (!user || !sessionId) return;
    
    const currentPart = participants.find(p => p.userId === user.uid);
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', `${sessionId}_${user.uid}`), {
      sessionId,
      userId: user.uid,
      name: currentPart?.name || 'User',
      preference: prefText,
      isHost: currentPart?.isHost || false
    }, { merge: true });
  };

  const startVoting = async () => {
    if (!user || !sessionId) return;
    setIsStarting(true);
    
    setLoadingMsg('Consulting the Yelp gods...');
    setView('loading');

    // Gather preferences
    const allPrefs = participants
      .map(p => p.preference)
      .filter(p => p && p.trim().length > 0)
      .join(' ');
    
    // Attempt Yelp Fetch
    let selected = await fetchYelpRestaurants(sessionData.location, allPrefs);

    if (!selected || selected.length === 0) {
      setUsingMock(true);
      // Fallback logic
      const shuffled = [...MOCK_RESTAURANTS].sort(() => 0.5 - Math.random());
      selected = shuffled.slice(0, 5);
      
      // Artificial delay if mocking so user sees loading state
      await new Promise(r => setTimeout(r, 2000));
    } else {
      setUsingMock(false);
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId), {
      status: 'voting',
      candidates: selected
    });
    
    setIsStarting(false);
  };

  const endVoting = async () => {
    if (!user || !sessionId || !sessionData) return;

    const counts = {};
    votes.forEach(v => {
      counts[v.restaurantId] = (counts[v.restaurantId] || 0) + 1;
    });
    
    let winnerId = null;
    let maxV = -1;
    
    if (votes.length === 0) {
       winnerId = sessionData.candidates[0].id;
    } else {
       Object.entries(counts).forEach(([rid, count]) => {
         if (count > maxV) {
           maxV = count;
           winnerId = rid;
         }
       });
       if (!winnerId) winnerId = sessionData.candidates[0].id;
    }

    const winner = sessionData.candidates.find(c => c.id === winnerId) || sessionData.candidates[0];

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sessionId), {
      status: 'finished',
      winner: winner
    });
  };

  const resetApp = () => {
    setSessionId(null);
    setSessionData(null);
    setParticipants([]);
    setVotes([]);
    setView('landing');
    setUsingMock(false);
    window.history.pushState({path:'/'},'','/');
  };

  return (
    <div className="font-sans antialiased text-gray-900 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 min-h-screen">
      {view === 'landing' && <Landing onStart={createSession} />}
      {view === 'join' && <JoinSession onJoin={joinSession} sessionId={sessionId} />}
      {view === 'lobby' && sessionData && (
        <Lobby 
          session={sessionData} 
          participants={participants} 
          userId={user?.uid}
          onSubmitPref={submitPreference}
          onStartVoting={startVoting}
          isStarting={isStarting}
        />
      )}
      {view === 'loading' && <LoadingSpinner message={loadingMsg} isMock={usingMock} />}
      {view === 'voting' && sessionData && (
        <>
          <Voting 
            session={sessionData} 
            candidates={sessionData.candidates || []} 
            userId={user?.uid}
            onVote={async (rid) => {
               const voteDocId = `${sessionId}_${user.uid}_${rid}`;
               const existing = votes.find(v => v.userId === user.uid && v.restaurantId === rid);
               
               if (existing) {
                  try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'votes', voteDocId));
                  } catch (e) {
                     console.error("Error removing vote", e);
                  }
               } else {
                 await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'votes', voteDocId), {
                    sessionId,
                    userId: user.uid,
                    restaurantId: rid
                 });
               }
            }}
            votes={votes}
          />
          {sessionData.hostId === user?.uid && (
            <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
              <button
                onClick={endVoting}
                className="pointer-events-auto bg-gray-900 text-white font-bold py-4 px-10 rounded-full shadow-2xl hover:scale-105 transform transition-all flex items-center gap-3 border border-gray-700"
              >
                <Trophy size={18} className="text-yellow-400" />
                End Voting & Reveal Winner
              </button>
            </div>
          )}
        </>
      )}
      {view === 'winner' && sessionData?.winner && (
        <Winner winner={sessionData.winner} onReset={resetApp} />
      )}
    </div>
  );
}
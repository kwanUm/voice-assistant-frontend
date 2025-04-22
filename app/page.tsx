"use client";

import { CloseIcon } from "@/components/CloseIcon";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import TranscriptionView from "@/components/TranscriptionView";
import {
  BarVisualizer,
  DisconnectButton,
  RoomAudioRenderer,
  RoomContext,
  VoiceAssistantControlBar,
  useVoiceAssistant,
} from "@livekit/components-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { AnimatePresence, motion } from "framer-motion";
import { Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import type { ConnectionDetails, RoomInfo, RoomList } from "./api/connection-details/route";

export default function Page() {
  const [room] = useState(new Room());
  const [availableRooms, setAvailableRooms] = useState<RoomInfo[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [customRoom, setCustomRoom] = useState<string>("");
  const [showRoomSelection, setShowRoomSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAvailableRooms = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = new URL(
        `${process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details"}?list=true`,
        window.location.origin
      );
      const response = await fetch(url.toString());
      const roomsData: RoomList = await response.json();
      setAvailableRooms(roomsData.rooms);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectToRoom = useCallback(async () => {
    const roomToJoin = selectedRoom || customRoom;
    console.log("roomToJoin", roomToJoin);
    const roomParam = roomToJoin ? `?room=${encodeURIComponent(roomToJoin)}` : "";
    
    const url = new URL(
      `${process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details"}${roomParam}`,
      window.location.origin
    );
    const response = await fetch(url.toString());
    const connectionDetailsData: ConnectionDetails = await response.json();

    await room.connect(connectionDetailsData.serverUrl, connectionDetailsData.participantToken);
    await room.localParticipant.setMicrophoneEnabled(true);
  }, [room, selectedRoom, customRoom]);

  const handleJoinRoom = useCallback(() => {
    setShowRoomSelection(false);
    connectToRoom();
  }, [connectToRoom]);

  const handleStartConversation = useCallback(() => {
    setShowRoomSelection(true);
  }, []);

  useEffect(() => {
    room.on(RoomEvent.MediaDevicesError, onDeviceFailure);

    return () => {
      room.off(RoomEvent.MediaDevicesError, onDeviceFailure);
    };
  }, [room]);

  return (
    <main data-lk-theme="default" className="h-full grid content-center bg-[var(--lk-bg)]">
      <RoomContext.Provider value={room}>
        <div className="lk-room-container max-h-[90vh]">
          {showRoomSelection ? (
            <RoomSelectionUI 
              availableRooms={availableRooms}
              selectedRoom={selectedRoom}
              setSelectedRoom={setSelectedRoom}
              customRoom={customRoom}
              setCustomRoom={setCustomRoom}
              onJoinRoom={handleJoinRoom}
              isLoading={isLoading}
              onRefresh={fetchAvailableRooms}
            />
          ) : (
            <SimpleVoiceAssistant 
              onConnectButtonClicked={handleStartConversation} 
            />
          )}
        </div>
      </RoomContext.Provider>
    </main>
  );
}

function RoomSelectionUI({
  availableRooms,
  selectedRoom,
  setSelectedRoom,
  customRoom,
  setCustomRoom,
  onJoinRoom,
  isLoading,
  onRefresh
}: {
  availableRooms: RoomInfo[];
  selectedRoom: string;
  setSelectedRoom: (room: string) => void;
  customRoom: string;
  setCustomRoom: (room: string) => void;
  onJoinRoom: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-md mx-auto rounded-lg p-6 shadow-md room-selection-container border"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Join a Room</h2>
        <button 
          onClick={onRefresh}
          className="text-sm room-selection-refresh"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>
      
      {isLoading ? (
        <div className="py-4 text-center">Loading available rooms...</div>
      ) : (
        <>
          {availableRooms.length > 0 ? (
            <>
              <p className="mb-2 text-sm">Select an existing room:</p>
              <div className="mb-4 space-y-2 max-h-60 overflow-y-auto">
                {availableRooms.map((room) => (
                  <div 
                    key={room.name} 
                    className="flex items-center p-2 border rounded room-selection-item cursor-pointer"
                    onClick={() => {
                      setSelectedRoom(room.name);
                      setCustomRoom("");
                    }}
                  >
                    <input
                      type="radio"
                      id={room.name}
                      name="roomSelection"
                      value={room.name}
                      checked={selectedRoom === room.name}
                      onChange={() => {}}
                      className="mr-3"
                    />
                    <label htmlFor={room.name} className="flex-1 cursor-pointer">
                      <div className="font-medium">{room.name}</div>
                      <div className="text-xs opacity-70">
                        {room.numParticipants} participant{room.numParticipants !== 1 ? 's' : ''}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mb-4 text-sm opacity-70">No active rooms available. Create a new one below.</p>
          )}
          
          <div className="mb-4">
            <p className="mb-2 text-sm">Or create/join a custom room:</p>
            <input
              type="text"
              value={customRoom}
              onChange={(e) => {
                setCustomRoom(e.target.value);
                setSelectedRoom("");
              }}
              placeholder="Enter room name"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 room-selection-input"
            />
          </div>
        </>
      )}
      
      <div className="flex justify-between">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-md room-selection-button-secondary"
        >
          Cancel
        </button>
        <button
          onClick={onJoinRoom}
          disabled={isLoading || (!selectedRoom && !customRoom)}
          className={`px-4 py-2 rounded-md ${
            isLoading || (!selectedRoom && !customRoom)
              ? "opacity-50 cursor-not-allowed"
              : ""
          } room-selection-button-primary`}
        >
          Join Room
        </button>
      </div>
    </motion.div>
  );
}

function SimpleVoiceAssistant(props: { onConnectButtonClicked: () => void }) {
  const { state: agentState } = useVoiceAssistant();
  return (
    <>
      <AnimatePresence>
        {agentState === "disconnected" && (
          <motion.button
            initial={{ opacity: 0, top: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 1, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="uppercase absolute left-1/2 -translate-x-1/2 px-4 py-2 bg-white text-black rounded-md"
            onClick={() => props.onConnectButtonClicked()}
          >
            Start a conversation
          </motion.button>
        )}
        <div className="w-3/4 lg:w-1/2 mx-auto h-full">
          <TranscriptionView />
        </div>
      </AnimatePresence>

      <RoomAudioRenderer />
      <NoAgentNotification state={agentState} />
      <div className="fixed bottom-0 w-full px-4 py-2">
        <ControlBar />
      </div>
    </>
  );
}

function ControlBar() {
  /**
   * Use Krisp background noise reduction when available.
   * Note: This is only available on Scale plan, see {@link https://livekit.io/pricing | LiveKit Pricing} for more details.
   */
  const krisp = useKrispNoiseFilter();
  useEffect(() => {
    krisp.setNoiseFilterEnabled(true);
  }, []);

  const { state: agentState, audioTrack } = useVoiceAssistant();

  return (
    <div className="relative h-[100px]">
      <AnimatePresence>
        {agentState !== "disconnected" && agentState !== "connecting" && (
          <motion.div
            initial={{ opacity: 0, top: "10px" }}
            animate={{ opacity: 1, top: 0 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 0.4, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="flex absolute w-full h-full justify-between px-8 sm:px-4"
          >
            <BarVisualizer
              state={agentState}
              barCount={5}
              trackRef={audioTrack}
              className="agent-visualizer w-24 gap-2"
              options={{ minHeight: 12 }}
            />
            <div className="flex items-center">
              <VoiceAssistantControlBar controls={{ leave: false }} />
              <DisconnectButton>
                <CloseIcon />
              </DisconnectButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function onDeviceFailure(error: Error) {
  console.error(error);
  alert(
    "Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}

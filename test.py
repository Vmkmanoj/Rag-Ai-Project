import queue
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

# -----------------------------
# Load Whisper Model
# -----------------------------

model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

# -----------------------------
# Audio Queue
# -----------------------------

audio_queue = queue.Queue()

samplerate = 16000
block_duration = 3  # seconds

# -----------------------------
# Audio Callback
# -----------------------------

def callback(indata, frames, time, status):
    audio_queue.put(indata.copy())

# -----------------------------
# Start Microphone Stream
# -----------------------------

print("Listening... Speak now.")

with sd.InputStream(
    samplerate=samplerate,
    channels=1,
    dtype="float32",
    callback=callback
):

    audio_buffer = np.empty((0, 1), dtype=np.float32)

    while True:

        data = audio_queue.get()

        audio_buffer = np.concatenate(
            [audio_buffer, data]
        )

        # Process every few seconds
        if len(audio_buffer) >= samplerate * block_duration:

            audio_array = audio_buffer.flatten()

            segments, info = model.transcribe(
                audio_array,
                beam_size=5,
                language="en"
            )

            for segment in segments:
                if(segment.text.strip() == "Exit now"):
                    print("Exiting...")
                    exit(0)
                print(segment.text)

            # Clear buffer
            audio_buffer = np.empty((0, 1), dtype=np.float32)
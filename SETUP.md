# Setup Instructions

## 1. Get an OpenAI API Key

Go to [OpenAI Platform](https://platform.openai.com/api-keys) and create a new API key.

## 2. Set Up Environment

### Option A: Using start_server.bat (Windows)

```bash
# Copy the example file
copy start_server.bat.example start_server.bat

# Edit start_server.bat and replace "your-openai-api-key-here" with your actual key
```

### Option B: Set Environment Variable (Recommended)

In PowerShell:
```powershell
$env:OPENAI_API_KEY = "your-actual-key-here"
py server.py
```

## 3. Run the Server

```bash
# If using start_server.bat:
./start_server.bat

# If using environment variable:
py server.py
```

## Important Security Note

⚠️ **NEVER commit your API key to Git!**
- `start_server.bat` is gitignored to protect your key
- Always use `start_server.bat.example` as a template

## If Your Key Was Exposed

If you accidentally committed your API key:
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Delete the exposed key
3. Create a new one
4. Update your local `start_server.bat`

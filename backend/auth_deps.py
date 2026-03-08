from fastapi import HTTPException, Header
import jwt

JWT_SECRET = "b50066cd-a4b9-41b0-b7ac-a5356307d6f3" 

def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Token")
    
    try:
        # Cut "Bearer " 
        token = authorization.split(" ")[1]
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        
        user_id = payload.get("sub")
        return user_id
        
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid Token")
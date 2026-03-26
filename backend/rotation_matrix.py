import numpy as np
# Rotation Matrix Function https://msl.cs.uiuc.edu/planning/node102.html
def get_rotation_matrix(yaw, pitch, roll):
    y = np.radians(yaw)
    p = np.radians(pitch)
    r = np.radians(roll)
    
    Rz = np.array([
        [np.cos(y), -np.sin(y), 0],
        [np.sin(y),  np.cos(y), 0],
        [0,          0,         1]
    ])
    
    Ry = np.array([
        [np.cos(p),  0, np.sin(p)],
        [0,          1, 0        ],
        [-np.sin(p), 0, np.cos(p)]
    ])
    
    Rx = np.array([
        [1, 0,          0        ],
        [0, np.cos(r), -np.sin(r)],
        [0, np.sin(r),  np.cos(r)]
    ])
    
    R = Rz @ Ry @ Rx
    
    return R
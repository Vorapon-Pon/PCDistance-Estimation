import numpy as np
from rotation_matrix import get_rotation_matrix

def get_projected_points(pcd_points, yaw, pitch, roll, W, H):
    R = get_rotation_matrix(yaw, pitch, roll)
    rotated_points = pcd_points @ R.T
    
    rotated_x = rotated_points[:, 0]
    rotated_y = rotated_points[:, 1]
    rotated_z = rotated_points[:, 2]

    d = np.sqrt(rotated_x**2 + rotated_y**2 + rotated_z**2)
    d[d == 0] = 1e-6  # ป้องกันหารด้วย 0

    yaw_pt = np.arctan2(rotated_y, rotated_x) 
    pitch_pt = np.arcsin(np.clip(rotated_z / d, -1, 1))

    u = (yaw_pt  / (2 * np.pi) + 0.5) * W
    v = (0.5 - (pitch_pt / np.pi)) * H

    valid_mask = (v >= 0) & (v < H) & (d > 2) & (d < 100)

    u_valid = u[valid_mask].astype(int)
    v_valid = v[valid_mask].astype(int)
    d_valid = d[valid_mask]

    # พลิกแกน u ตามโค้ดต้นฉบับ
    u_valid = W - u_valid

    return u_valid, v_valid, d_valid
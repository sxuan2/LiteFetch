import json
import time
import uuid
import hashlib

def generate_dynamic_vars():
    # 1. 创建一个字典，用于存放所有你想注入到前端的动态变量
    dynamic_vars = {}

    # ---------------------------------------------------------
    # 在这里编写你的业务逻辑，生成你需要的动态数据
    # ---------------------------------------------------------
    
    # 示例 A：生成当前时间戳（常用于 API 签名防重放）
    current_timestamp = str(int(time.time()))
    dynamic_vars["timestamp"] = current_timestamp

    # 示例 B：生成一个随机的 UUID（常用于 Request ID 或 幂等性 Token）
    dynamic_vars["request_id"] = str(uuid.uuid4())

    # 示例 C：生成 MD5 或 SHA256 签名（常用于 Auth 或 接口加密校验）
    # 假设你的 API 需要把 timestamp 和一个固定的 secret 拼接后求 MD5
    secret_key = "my_super_secret"
    raw_str = f"{current_timestamp}_{secret_key}"
    sign = hashlib.md5(raw_str.encode('utf-8')).hexdigest()
    dynamic_vars["api_sign"] = sign

    # 示例 D：写死的一些特定测试数据
    dynamic_vars["test_user_id"] = "USER_998877"

    # ---------------------------------------------------------
    
    print(json.dumps(dynamic_vars))

if __name__ == "__main__":
    try:
        generate_dynamic_vars()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
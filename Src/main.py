"""Run the local game; also exports app for Flask CLI and WSGI servers."""
import webbrowser
from threading import Timer

from web.app import app


if __name__ == "__main__":
    print("=" * 65)
    print("Đang khởi động Bloxorz 3D AI Solver tại: http://127.0.0.1:5000")
    print("=" * 65)
    Timer(1.0, lambda: webbrowser.open("http://127.0.0.1:5000")).start()
    app.run(host="127.0.0.1", port=5000, debug=False)

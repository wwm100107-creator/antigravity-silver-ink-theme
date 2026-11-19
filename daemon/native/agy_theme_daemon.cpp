// Antigravity Custom Theme Native Windows Daemon (Ultra-Low-RAM Win32 / WinSock2)
// Replaces Node.js V8 (~65 MB RAM) with a standalone native static executable (~2-3 MB RAM).
// Supports: local loopback 60fps HTTP Range asset server, CDP WebSocket page attach,
// Page.addScriptToEvaluateOnNewDocument + Runtime.evaluate, agySaveThemeConfig binding,
// and automatic hot-reload on dist/theme_payload.js changes.

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <process.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <utility>
#include <vector>

#pragma comment(lib, "ws2_32.lib")

namespace {

// --- UTF-8 / UTF-16 helpers ---
std::wstring utf8ToWide(const std::string& s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    if (n <= 0) return L"";
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), &w[0], n);
    return w;
}

std::string wideToUtf8(const std::wstring& w) {
    if (w.empty()) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), nullptr, 0, nullptr, nullptr);
    if (n <= 0) return "";
    std::string s(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), &s[0], n, nullptr, nullptr);
    return s;
}

std::wstring getEnvWide(const wchar_t* name) {
    DWORD n = GetEnvironmentVariableW(name, nullptr, 0);
    if (n == 0) return L"";
    std::wstring buf(n, L'\0');
    DWORD got = GetEnvironmentVariableW(name, &buf[0], n);
    if (got == 0) return L"";
    buf.resize(got);
    return buf;
}

bool fileExists(const std::wstring& p) {
    DWORD a = GetFileAttributesW(p.c_str());
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

bool readFileAll(const std::wstring& p, std::string& out) {
    out.clear();
    HANDLE h = CreateFileW(p.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                           nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER sz{};
    if (!GetFileSizeEx(h, &sz) || sz.QuadPart < 0 || sz.QuadPart > 64LL * 1024 * 1024) {
        CloseHandle(h);
        return false;
    }
    out.resize((size_t)sz.QuadPart);
    size_t pos = 0;
    while (pos < out.size()) {
        DWORD chunk = (DWORD)std::min<size_t>(out.size() - pos, 1024 * 1024);
        DWORD got = 0;
        if (!ReadFile(h, &out[pos], chunk, &got, nullptr) || got == 0) break;
        pos += got;
    }
    CloseHandle(h);
    out.resize(pos);
    return true;
}

bool writeFileAtomic(const std::wstring& p, const std::string& data) {
    std::wstring tmp = p + L".tmp";
    HANDLE h = CreateFileW(tmp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) return false;
    size_t pos = 0;
    bool ok = true;
    while (pos < data.size()) {
        DWORD chunk = (DWORD)std::min<size_t>(data.size() - pos, 1024 * 1024);
        DWORD wrote = 0;
        if (!WriteFile(h, data.data() + pos, chunk, &wrote, nullptr) || wrote != chunk) {
            ok = false;
            break;
        }
        pos += wrote;
    }
    CloseHandle(h);
    if (!ok) {
        DeleteFileW(tmp.c_str());
        return false;
    }
    if (!MoveFileExW(tmp.c_str(), p.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        DeleteFileW(tmp.c_str());
        return false;
    }
    return true;
}

uint64_t getFileWriteTime64(const std::wstring& p) {
    WIN32_FILE_ATTRIBUTE_DATA fad{};
    if (!GetFileAttributesExW(p.c_str(), GetFileExInfoStandard, &fad)) return 0;
    return ((uint64_t)fad.ftLastWriteTime.dwHighDateTime << 32) | fad.ftLastWriteTime.dwLowDateTime;
}

std::wstring parentDir(const std::wstring& p) {
    size_t pos = p.find_last_of(L"\\/");
    if (pos == std::wstring::npos) return L".";
    return p.substr(0, pos);
}

// --- Globals ---
std::wstring g_rootDir;
std::wstring g_themesDir;
std::wstring g_pidFile;
std::wstring g_configFile;
std::wstring g_payloadPath;
std::wstring g_logFile;
std::atomic<uint16_t> g_assetPort{0};
std::atomic<bool> g_running{true};
std::mutex g_logMtx;
std::mutex g_configMtx;

void trimWorkingSet() {
    SetProcessWorkingSetSize(GetCurrentProcess(), (SIZE_T)-1, (SIZE_T)-1);
}

void logMsg(const std::string& msg) {
    SYSTEMTIME st{};
    GetSystemTime(&st);
    char ts[64];
    std::snprintf(ts, sizeof(ts), "[%04u-%02u-%02uT%02u:%02u:%02u.%03uZ] ",
                  st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond, st.wMilliseconds);
    std::string line = std::string(ts) + msg + "\n";

    std::lock_guard<std::mutex> lk(g_logMtx);
    WIN32_FILE_ATTRIBUTE_DATA fad{};
    DWORD disp = OPEN_ALWAYS;
    if (GetFileAttributesExW(g_logFile.c_str(), GetFileExInfoStandard, &fad)) {
        uint64_t sz = ((uint64_t)fad.nFileSizeHigh << 32) | fad.nFileSizeLow;
        if (sz > 512 * 1024) disp = CREATE_ALWAYS;
    }
    HANDLE h = CreateFileW(g_logFile.c_str(), FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE,
                           nullptr, disp, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h != INVALID_HANDLE_VALUE) {
        DWORD w = 0;
        WriteFile(h, line.data(), (DWORD)line.size(), &w, nullptr);
        CloseHandle(h);
    }
}

// --- Minimal RFC-8259 JSON parser & serializer ---
struct JsonVal {
    enum Type { JNull, JBool, JNum, JStr, JArr, JObj } type = JNull;
    bool bval = false;
    std::string sval; // raw number text for JNum, unescaped UTF-8 for JStr
    std::vector<JsonVal> arr;
    std::vector<std::pair<std::string, JsonVal>> obj; // insertion-order preserving

    const JsonVal* get(const std::string& k) const {
        if (type != JObj) return nullptr;
        for (const auto& kv : obj) {
            if (kv.first == k) return &kv.second;
        }
        return nullptr;
    }
    void set(const std::string& k, JsonVal v) {
        if (type != JObj) {
            type = JObj;
            obj.clear();
        }
        for (auto& kv : obj) {
            if (kv.first == k) {
                kv.second = std::move(v);
                return;
            }
        }
        obj.emplace_back(k, std::move(v));
    }
    std::string asStr(const std::string& def = "") const {
        return type == JStr ? sval : def;
    }
};

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 16);
    out.push_back('"');
    for (unsigned char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", (unsigned)c);
                    out += buf;
                } else {
                    out.push_back((char)c);
                }
                break;
        }
    }
    out.push_back('"');
    return out;
}

void appendUtf8Codepoint(std::string& out, uint32_t cp) {
    if (cp <= 0x7F) {
        out.push_back((char)cp);
    } else if (cp <= 0x7FF) {
        out.push_back((char)(0xC0 | (cp >> 6)));
        out.push_back((char)(0x80 | (cp & 0x3F)));
    } else if (cp <= 0xFFFF) {
        out.push_back((char)(0xE0 | (cp >> 12)));
        out.push_back((char)(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back((char)(0x80 | (cp & 0x3F)));
    } else if (cp <= 0x10FFFF) {
        out.push_back((char)(0xF0 | (cp >> 18)));
        out.push_back((char)(0x80 | ((cp >> 12) & 0x3F)));
        out.push_back((char)(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back((char)(0x80 | (cp & 0x3F)));
    }
}

struct JsonParser {
    const std::string& s;
    size_t i = 0;

    void skipWs() {
        while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n')) ++i;
    }

    bool parseHex4(uint32_t& out) {
        if (i + 4 > s.size()) return false;
        out = 0;
        for (int k = 0; k < 4; ++k) {
            char c = s[i++];
            out <<= 4;
            if (c >= '0' && c <= '9') out |= (uint32_t)(c - '0');
            else if (c >= 'a' && c <= 'f') out |= (uint32_t)(c - 'a' + 10);
            else if (c >= 'A' && c <= 'F') out |= (uint32_t)(c - 'A' + 10);
            else return false;
        }
        return true;
    }

    bool parseString(std::string& out) {
        if (i >= s.size() || s[i] != '"') return false;
        ++i;
        out.clear();
        while (i < s.size()) {
            char c = s[i++];
            if (c == '"') return true;
            if (c == '\\') {
                if (i >= s.size()) return false;
                char e = s[i++];
                switch (e) {
                    case '"': out.push_back('"'); break;
                    case '\\': out.push_back('\\'); break;
                    case '/': out.push_back('/'); break;
                    case 'b': out.push_back('\b'); break;
                    case 'f': out.push_back('\f'); break;
                    case 'n': out.push_back('\n'); break;
                    case 'r': out.push_back('\r'); break;
                    case 't': out.push_back('\t'); break;
                    case 'u': {
                        uint32_t cp = 0;
                        if (!parseHex4(cp)) return false;
                        if (cp >= 0xD800 && cp <= 0xDBFF && i + 6 <= s.size() && s[i] == '\\' && s[i + 1] == 'u') {
                            size_t saved = i;
                            i += 2;
                            uint32_t low = 0;
                            if (parseHex4(low) && low >= 0xDC00 && low <= 0xDFFF) {
                                cp = 0x10000 + (((cp - 0xD800) << 10) | (low - 0xDC00));
                            } else {
                                i = saved;
                            }
                        }
                        appendUtf8Codepoint(out, cp);
                        break;
                    }
                    default: out.push_back(e); break;
                }
            } else {
                out.push_back(c);
            }
        }
        return false;
    }

    bool parseVal(JsonVal& out, int depth = 0) {
        if (depth > 64) return false;
        skipWs();
        if (i >= s.size()) return false;
        char c = s[i];
        if (c == '"') {
            out.type = JsonVal::JStr;
            return parseString(out.sval);
        }
        if (c == '{') {
            ++i;
            out.type = JsonVal::JObj;
            out.obj.clear();
            skipWs();
            if (i < s.size() && s[i] == '}') { ++i; return true; }
            while (i < s.size()) {
                skipWs();
                std::string key;
                if (!parseString(key)) return false;
                skipWs();
                if (i >= s.size() || s[i] != ':') return false;
                ++i;
                JsonVal v;
                if (!parseVal(v, depth + 1)) return false;
                out.set(key, std::move(v));
                skipWs();
                if (i < s.size() && s[i] == ',') { ++i; continue; }
                if (i < s.size() && s[i] == '}') { ++i; return true; }
                return false;
            }
            return false;
        }
        if (c == '[') {
            ++i;
            out.type = JsonVal::JArr;
            out.arr.clear();
            skipWs();
            if (i < s.size() && s[i] == ']') { ++i; return true; }
            while (i < s.size()) {
                JsonVal v;
                if (!parseVal(v, depth + 1)) return false;
                out.arr.push_back(std::move(v));
                skipWs();
                if (i < s.size() && s[i] == ',') { ++i; continue; }
                if (i < s.size() && s[i] == ']') { ++i; return true; }
                return false;
            }
            return false;
        }
        if (s.compare(i, 4, "true") == 0) { i += 4; out.type = JsonVal::JBool; out.bval = true; return true; }
        if (s.compare(i, 5, "false") == 0) { i += 5; out.type = JsonVal::JBool; out.bval = false; return true; }
        if (s.compare(i, 4, "null") == 0) { i += 4; out.type = JsonVal::JNull; return true; }
        if (c == '-' || (c >= '0' && c <= '9')) {
            size_t start = i;
            if (s[i] == '-') ++i;
            while (i < s.size() && (std::isdigit((unsigned char)s[i]) || s[i] == '.' || s[i] == 'e' || s[i] == 'E' || s[i] == '+' || s[i] == '-')) ++i;
            out.type = JsonVal::JNum;
            out.sval = s.substr(start, i - start);
            return !out.sval.empty();
        }
        return false;
    }
};

bool parseJson(const std::string& s, JsonVal& out) {
    JsonParser p{s, 0};
    if (!p.parseVal(out)) return false;
    return true;
}

void serializeJsonRec(const JsonVal& v, std::string& out, bool pretty, int indent) {
    switch (v.type) {
        case JsonVal::JNull: out += "null"; break;
        case JsonVal::JBool: out += (v.bval ? "true" : "false"); break;
        case JsonVal::JNum:  out += v.sval; break;
        case JsonVal::JStr:  out += jsonEscape(v.sval); break;
        case JsonVal::JArr:
            out.push_back('[');
            for (size_t k = 0; k < v.arr.size(); ++k) {
                if (k > 0) out.push_back(',');
                if (pretty) { out.push_back('\n'); out.append(indent + 2, ' '); }
                serializeJsonRec(v.arr[k], out, pretty, indent + 2);
            }
            if (pretty && !v.arr.empty()) { out.push_back('\n'); out.append(indent, ' '); }
            out.push_back(']');
            break;
        case JsonVal::JObj:
            out.push_back('{');
            for (size_t k = 0; k < v.obj.size(); ++k) {
                if (k > 0) out.push_back(',');
                if (pretty) { out.push_back('\n'); out.append(indent + 2, ' '); }
                out += jsonEscape(v.obj[k].first);
                out += (pretty ? ": " : ":");
                serializeJsonRec(v.obj[k].second, out, pretty, indent + 2);
            }
            if (pretty && !v.obj.empty()) { out.push_back('\n'); out.append(indent, ' '); }
            out.push_back('}');
            break;
    }
}

std::string serializeJson(const JsonVal& v, bool pretty = false) {
    std::string out;
    serializeJsonRec(v, out, pretty, 0);
    return out;
}

// --- Config read/write ---
JsonVal readConfigLocked() {
    JsonVal cfg;
    cfg.type = JsonVal::JObj;
    std::string raw;
    if (readFileAll(g_configFile, raw)) {
        JsonVal parsed;
        if (parseJson(raw, parsed) && parsed.type == JsonVal::JObj) {
            cfg = std::move(parsed);
        }
    }
    return cfg;
}

bool saveConfigMerge(const std::string& payloadJsonStr) {
    JsonVal incoming;
    if (!parseJson(payloadJsonStr, incoming) || incoming.type != JsonVal::JObj) return false;
    std::lock_guard<std::mutex> lk(g_configMtx);
    JsonVal merged = readConfigLocked();
    for (const auto& kv : incoming.obj) {
        merged.set(kv.first, kv.second);
    }
    std::string out = serializeJson(merged, true) + "\n";
    return writeFileAtomic(g_configFile, out);
}

// --- Socket helpers ---
bool sendAll(SOCKET s, const char* data, size_t len) {
    size_t sent = 0;
    while (sent < len) {
        int n = send(s, data + sent, (int)std::min<size_t>(len - sent, 65536), 0);
        if (n <= 0) return false;
        sent += (size_t)n;
    }
    return true;
}

bool recvExact(SOCKET s, char* buf, size_t len) {
    size_t got = 0;
    while (got < len) {
        int n = recv(s, buf + got, (int)std::min<size_t>(len - got, 65536), 0);
        if (n <= 0) return false;
        got += (size_t)n;
    }
    return true;
}

SOCKET connectLoopback(uint16_t port, int timeoutMs = 2000) {
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) return INVALID_SOCKET;
    DWORD tv = (DWORD)timeoutMs;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, (const char*)&tv, sizeof(tv));
    BOOL nodelay = TRUE;
    setsockopt(s, IPPROTO_TCP, TCP_NODELAY, (const char*)&nodelay, sizeof(nodelay));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(s, (const sockaddr*)&addr, sizeof(addr)) != 0) {
        closesocket(s);
        return INVALID_SOCKET;
    }
    return s;
}

// --- Local 60fps HTTP Range Asset Server ---
std::string urlDecode(const std::string& in) {
    std::string out;
    out.reserve(in.size());
    for (size_t i = 0; i < in.size(); ++i) {
        if (in[i] == '%' && i + 2 < in.size() &&
            std::isxdigit((unsigned char)in[i + 1]) && std::isxdigit((unsigned char)in[i + 2])) {
            auto hv = [](char c) -> int {
                if (c >= '0' && c <= '9') return c - '0';
                if (c >= 'a' && c <= 'f') return c - 'a' + 10;
                return c - 'A' + 10;
            };
            out.push_back((char)((hv(in[i + 1]) << 4) | hv(in[i + 2])));
            i += 2;
        } else {
            out.push_back(in[i]);
        }
    }
    return out;
}

const char* mimeForExt(const std::wstring& path) {
    size_t dot = path.find_last_of(L'.');
    if (dot == std::wstring::npos) return "application/octet-stream";
    std::wstring ext = path.substr(dot);
    for (auto& ch : ext) ch = (wchar_t)towlower(ch);
    if (ext == L".mp4") return "video/mp4";
    if (ext == L".webm") return "video/webm";
    if (ext == L".webp") return "image/webp";
    if (ext == L".png") return "image/png";
    if (ext == L".jpg" || ext == L".jpeg") return "image/jpeg";
    if (ext == L".svg") return "image/svg+xml";
    return "application/octet-stream";
}

unsigned __stdcall handleHttpClient(void* arg) {
    SOCKET c = (SOCKET)(uintptr_t)arg;
    DWORD tv = 5000;
    setsockopt(c, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
    setsockopt(c, SOL_SOCKET, SO_SNDTIMEO, (const char*)&tv, sizeof(tv));

    std::string req;
    req.reserve(2048);
    char tmp[2048];
    while (req.size() < 16384) {
        int n = recv(c, tmp, sizeof(tmp), 0);
        if (n <= 0) break;
        req.append(tmp, n);
        if (req.find("\r\n\r\n") != std::string::npos) break;
    }

    size_t sp1 = req.find(' ');
    size_t sp2 = sp1 != std::string::npos ? req.find(' ', sp1 + 1) : std::string::npos;
    if (sp1 == std::string::npos || sp2 == std::string::npos) {
        closesocket(c);
        return 0;
    }
    std::string method = req.substr(0, sp1);
    std::string rawTarget = req.substr(sp1 + 1, sp2 - sp1 - 1);

    if (method == "OPTIONS") {
        const char* resp =
            "HTTP/1.1 204 No Content\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n"
            "Access-Control-Allow-Headers: Range\r\n"
            "Cache-Control: no-store\r\n"
            "Connection: close\r\n\r\n";
        sendAll(c, resp, std::strlen(resp));
        closesocket(c);
        return 0;
    }

    size_t qpos = rawTarget.find('?');
    if (qpos != std::string::npos) rawTarget.resize(qpos);
    std::string decoded = urlDecode(rawTarget);
    while (!decoded.empty() && (decoded[0] == '/' || decoded[0] == '\\')) decoded.erase(decoded.begin());
    for (auto& ch : decoded) { if (ch == '/') ch = '\\'; }

    std::wstring joined = g_themesDir + L"\\" + utf8ToWide(decoded);
    wchar_t fullBuf[MAX_PATH * 4];
    wchar_t baseBuf[MAX_PATH * 4];
    DWORD fullLen = GetFullPathNameW(joined.c_str(), (DWORD)(sizeof(fullBuf) / sizeof(wchar_t)), fullBuf, nullptr);
    DWORD baseLen = GetFullPathNameW(g_themesDir.c_str(), (DWORD)(sizeof(baseBuf) / sizeof(wchar_t)), baseBuf, nullptr);

    std::wstring fullPath(fullBuf, fullLen);
    std::wstring basePath(baseBuf, baseLen);
    if (!basePath.empty() && basePath.back() != L'\\') basePath.push_back(L'\\');

    bool allowed = fullPath.size() > basePath.size() &&
                   _wcsnicmp(fullPath.c_str(), basePath.c_str(), basePath.size()) == 0 &&
                   fileExists(fullPath);

    if (!allowed) {
        const char* resp =
            "HTTP/1.1 404 Not Found\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Cache-Control: no-store\r\n"
            "Content-Length: 9\r\n"
            "Connection: close\r\n\r\nNot found";
        sendAll(c, resp, std::strlen(resp));
        closesocket(c);
        return 0;
    }

    HANDLE fh = CreateFileW(fullPath.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                            nullptr, OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
    if (fh == INVALID_HANDLE_VALUE) {
        closesocket(c);
        return 0;
    }
    LARGE_INTEGER liSize{};
    GetFileSizeEx(fh, &liSize);
    int64_t total = liSize.QuadPart;

    // Parse Range header (case-insensitive)
    bool hasRange = false;
    int64_t start = 0, end = total > 0 ? total - 1 : 0;
    std::string lowerReq = req;
    for (auto& ch : lowerReq) ch = (char)std::tolower((unsigned char)ch);
    size_t rpos = lowerReq.find("\r\nrange:");
    if (rpos != std::string::npos) {
        size_t eol = lowerReq.find("\r\n", rpos + 8);
        std::string rval = lowerReq.substr(rpos + 8, eol == std::string::npos ? std::string::npos : eol - (rpos + 8));
        size_t bpos = rval.find("bytes=");
        if (bpos != std::string::npos && total > 0) {
            std::string spec = rval.substr(bpos + 6);
            size_t dash = spec.find('-');
            if (dash != std::string::npos) {
                std::string s1 = spec.substr(0, dash);
                std::string s2 = spec.substr(dash + 1);
                if (!s1.empty()) {
                    start = std::max<int64_t>(0, std::atoll(s1.c_str()));
                    end = !s2.empty() ? std::min<int64_t>(total - 1, std::atoll(s2.c_str())) : (total - 1);
                } else if (!s2.empty()) {
                    int64_t suf = std::atoll(s2.c_str());
                    start = std::max<int64_t>(0, total - suf);
                    end = total - 1;
                }
                if (start <= end && start < total) hasRange = true;
            }
        }
    }

    const char* mime = mimeForExt(fullPath);
    char hdr[512];
    int64_t sendLen = total > 0 ? (end - start + 1) : 0;
    if (hasRange) {
        std::snprintf(hdr, sizeof(hdr),
                      "HTTP/1.1 206 Partial Content\r\n"
                      "Access-Control-Allow-Origin: *\r\n"
                      "Cache-Control: no-store\r\n"
                      "Accept-Ranges: bytes\r\n"
                      "Content-Range: bytes %lld-%lld/%lld\r\n"
                      "Content-Length: %lld\r\n"
                      "Content-Type: %s\r\n"
                      "Connection: close\r\n\r\n",
                      (long long)start, (long long)end, (long long)total, (long long)sendLen, mime);
    } else {
        start = 0;
        sendLen = total;
        std::snprintf(hdr, sizeof(hdr),
                      "HTTP/1.1 200 OK\r\n"
                      "Access-Control-Allow-Origin: *\r\n"
                      "Cache-Control: no-store\r\n"
                      "Accept-Ranges: bytes\r\n"
                      "Content-Length: %lld\r\n"
                      "Content-Type: %s\r\n"
                      "Connection: close\r\n\r\n",
                      (long long)sendLen, mime);
    }

    if (sendAll(c, hdr, std::strlen(hdr)) && method != "HEAD" && sendLen > 0) {
        LARGE_INTEGER seekPos{};
        seekPos.QuadPart = start;
        SetFilePointerEx(fh, seekPos, nullptr, FILE_BEGIN);
        std::vector<char> buf(65536);
        int64_t rem = sendLen;
        while (rem > 0) {
            DWORD toRead = (DWORD)std::min<int64_t>(rem, (int64_t)buf.size());
            DWORD got = 0;
            if (!ReadFile(fh, buf.data(), toRead, &got, nullptr) || got == 0) break;
            if (!sendAll(c, buf.data(), got)) break;
            rem -= got;
        }
    }

    CloseHandle(fh);
    closesocket(c);
    return 0;
}

unsigned __stdcall assetServerThread(void*) {
    SOCKET srv = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (srv == INVALID_SOCKET) return 0;

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = 0;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(srv, (const sockaddr*)&addr, sizeof(addr)) != 0 || listen(srv, 16) != 0) {
        closesocket(srv);
        return 0;
    }
    int alen = sizeof(addr);
    if (getsockname(srv, (sockaddr*)&addr, &alen) == 0) {
        g_assetPort.store(ntohs(addr.sin_port));
        logMsg("Local 60fps asset stream server listening on http://127.0.0.1:" + std::to_string(g_assetPort.load()));
    }

    while (g_running.load()) {
        fd_set fds;
        FD_ZERO(&fds);
        FD_SET(srv, &fds);
        timeval tv{0, 500000};
        int ready = select(0, &fds, nullptr, nullptr, &tv);
        if (ready <= 0) continue;
        SOCKET cli = accept(srv, nullptr, nullptr);
        if (cli == INVALID_SOCKET) continue;
        uintptr_t th = _beginthreadex(nullptr, 131072, handleHttpClient, (void*)(uintptr_t)cli, 0, nullptr);
        if (th) {
            CloseHandle((HANDLE)th);
        } else {
            closesocket(cli);
        }
    }
    closesocket(srv);
    return 0;
}

// --- Payload builder (ephemeral, never retains payload in daemon heap) ---
std::string buildInjectedSource() {
    std::string payload;
    if (!readFileAll(g_payloadPath, payload)) return "";

    JsonVal cfg;
    {
        std::lock_guard<std::mutex> lk(g_configMtx);
        cfg = readConfigLocked();
    }
    std::string cfgJson = serializeJson(cfg, false);
    uint16_t port = g_assetPort.load();
    std::string baseUrl = port ? ("http://127.0.0.1:" + std::to_string(port)) : "";

    std::string syncOps;
    if (const JsonVal* tn = cfg.get("themeName"); tn && tn->type == JsonVal::JStr && !tn->sval.empty()) {
        syncOps += "localStorage.setItem('agy_theme_v3', " + jsonEscape(tn->sval) + "); ";
        if (const JsonVal* bn = cfg.get("bubbleName"); bn && bn->type == JsonVal::JStr && !bn->sval.empty()) {
            syncOps += "localStorage.setItem('agy_bubble_v3', " + jsonEscape(bn->sval) + "); ";
        }
        if (const JsonVal* dm = cfg.get("dimming")) {
            std::string dmStr = (dm->type == JsonVal::JNum || dm->type == JsonVal::JStr) ? dm->sval : "";
            if (!dmStr.empty()) syncOps += "localStorage.setItem('agy_dimming_v3', " + jsonEscape(dmStr) + "); ";
        }
    }
    if (const JsonVal* pm = cfg.get("performanceMode"); pm && pm->type == JsonVal::JStr && !pm->sval.empty()) {
        syncOps += "localStorage.setItem('agy_perf_mode_v3', " + jsonEscape(pm->sval) + "); ";
    }

    std::string out;
    out.reserve(payload.size() + cfgJson.size() + 512);
    out += "window.__AGY_ASSET_BASE_URL__ = " + jsonEscape(baseUrl) + ";\n";
    out += "window.__AGY_INITIAL_CONFIG__ = " + cfgJson + ";\n";
    if (!syncOps.empty()) {
        out += "try { " + syncOps + "} catch (_) {}\n";
    }
    out += payload;
    return out;
}

// --- Loopback HTTP GET helper (for CDP /json) ---
bool httpGetLoopback(uint16_t port, const std::string& path, std::string& outBody) {
    outBody.clear();
    SOCKET s = connectLoopback(port, 2000);
    if (s == INVALID_SOCKET) return false;
    std::string req = "GET " + path + " HTTP/1.1\r\nHost: 127.0.0.1:" + std::to_string(port) +
                      "\r\nConnection: close\r\n\r\n";
    if (!sendAll(s, req.data(), req.size())) {
        closesocket(s);
        return false;
    }
    std::string raw;
    char buf[8192];
    while (true) {
        int n = recv(s, buf, sizeof(buf), 0);
        if (n <= 0) break;
        raw.append(buf, n);
        if (raw.size() > 4 * 1024 * 1024) break;
    }
    closesocket(s);

    size_t hdrEnd = raw.find("\r\n\r\n");
    if (hdrEnd == std::string::npos) return false;
    std::string hdr = raw.substr(0, hdrEnd);
    std::string body = raw.substr(hdrEnd + 4);
    std::string lowerHdr = hdr;
    for (auto& ch : lowerHdr) ch = (char)std::tolower((unsigned char)ch);

    if (lowerHdr.find("transfer-encoding: chunked") != std::string::npos) {
        size_t pos = 0;
        while (pos < body.size()) {
            size_t eol = body.find("\r\n", pos);
            if (eol == std::string::npos) break;
            size_t chunkLen = (size_t)std::strtoull(body.substr(pos, eol - pos).c_str(), nullptr, 16);
            pos = eol + 2;
            if (chunkLen == 0 || pos + chunkLen > body.size()) break;
            outBody.append(body, pos, chunkLen);
            pos += chunkLen + 2;
        }
    } else {
        outBody = std::move(body);
    }
    return !outBody.empty();
}

// --- RFC-6455 CDP WebSocket Session ---
struct CdpSession {
    std::string id;
    std::string url;
    std::string wsUrl;
    SOCKET sock = INVALID_SOCKET;
    std::mutex sendMtx;
    std::atomic<bool> alive{true};
    std::atomic<int> nextId{1};
    uint64_t rngState = 0x9e3779b97f4a7c15ULL;
    std::string lastDocScriptId;
    int pendingDocReqId = 0;

    bool sendWsFrame(uint8_t opcode, const char* data, size_t len) {
        std::lock_guard<std::mutex> lk(sendMtx);
        if (sock == INVALID_SOCKET || !alive.load()) return false;

        std::string frame;
        frame.reserve(len + 16);
        frame.push_back((char)(0x80 | (opcode & 0x0F)));
        if (len <= 125) {
            frame.push_back((char)(0x80 | len));
        } else if (len <= 65535) {
            frame.push_back((char)(0x80 | 126));
            frame.push_back((char)((len >> 8) & 0xFF));
            frame.push_back((char)(len & 0xFF));
        } else {
            frame.push_back((char)(0x80 | 127));
            for (int k = 7; k >= 0; --k) frame.push_back((char)((len >> (k * 8)) & 0xFF));
        }

        rngState ^= rngState >> 12;
        rngState ^= rngState << 25;
        rngState ^= rngState >> 27;
        uint32_t m = (uint32_t)((rngState * 0x2545F4914F6CDD1DULL) >> 32);
        uint8_t mask[4] = {(uint8_t)(m & 0xFF), (uint8_t)((m >> 8) & 0xFF),
                           (uint8_t)((m >> 16) & 0xFF), (uint8_t)((m >> 24) & 0xFF)};
        frame.append((const char*)mask, 4);
        size_t startOff = frame.size();
        frame.resize(startOff + len);
        for (size_t i = 0; i < len; ++i) {
            frame[startOff + i] = (char)((uint8_t)data[i] ^ mask[i & 3]);
        }
        return sendAll(sock, frame.data(), frame.size());
    }

    int sendCdp(const std::string& method, const std::string& paramsJson = "{}") {
        int cid = nextId.fetch_add(1);
        std::string msg = "{\"id\":" + std::to_string(cid) + ",\"method\":" + jsonEscape(method) +
                          ",\"params\":" + paramsJson + "}";
        if (!sendWsFrame(0x1, msg.data(), msg.size())) return 0;
        return cid;
    }

    void reinject(bool updateNewDoc = false) {
        std::string src = buildInjectedSource();
        if (src.empty()) return;
        std::string esc = jsonEscape(src);
        src.clear();
        src.shrink_to_fit();

        if (updateNewDoc) {
            if (!lastDocScriptId.empty()) {
                sendCdp("Page.removeScriptToEvaluateOnNewDocument",
                        "{\"identifier\":" + jsonEscape(lastDocScriptId) + "}");
                lastDocScriptId.clear();
            }
            pendingDocReqId = sendCdp("Page.addScriptToEvaluateOnNewDocument", "{\"source\":" + esc + "}");
        }
        sendCdp("Runtime.evaluate", "{\"expression\":" + esc + ",\"awaitPromise\":false}");
        esc.clear();
        esc.shrink_to_fit();
        trimWorkingSet();
    }

    void close() {
        alive.store(false);
        std::lock_guard<std::mutex> lk(sendMtx);
        if (sock != INVALID_SOCKET) {
            shutdown(sock, SD_BOTH);
            closesocket(sock);
            sock = INVALID_SOCKET;
        }
    }
};

std::mutex g_sessionsMtx;
std::map<std::string, std::shared_ptr<CdpSession>> g_sessions;

void reinjectAllSessions(const std::string& skipId, bool updateNewDoc) {
    std::vector<std::shared_ptr<CdpSession>> list;
    {
        std::lock_guard<std::mutex> lk(g_sessionsMtx);
        for (const auto& kv : g_sessions) {
            if (kv.first != skipId && kv.second && kv.second->alive.load()) {
                list.push_back(kv.second);
            }
        }
    }
    for (auto& s : list) s->reinject(updateNewDoc);
}

bool parseWsUrl(const std::string& wsUrl, uint16_t& outPort, std::string& outPath) {
    const std::string pfx = "ws://";
    if (wsUrl.compare(0, pfx.size(), pfx) != 0) return false;
    size_t hostStart = pfx.size();
    size_t slash = wsUrl.find('/', hostStart);
    std::string hostPort = slash == std::string::npos ? wsUrl.substr(hostStart) : wsUrl.substr(hostStart, slash - hostStart);
    outPath = slash == std::string::npos ? "/" : wsUrl.substr(slash);
    size_t colon = hostPort.find(':');
    if (colon == std::string::npos) return false;
    int p = std::atoi(hostPort.substr(colon + 1).c_str());
    if (p <= 0 || p > 65535) return false;
    outPort = (uint16_t)p;
    return true;
}

unsigned __stdcall sessionThreadProc(void* arg) {
    auto* holder = static_cast<std::shared_ptr<CdpSession>*>(arg);
    std::shared_ptr<CdpSession> sess = *holder;
    delete holder;

    uint16_t wsPort = 0;
    std::string wsPath;
    if (!parseWsUrl(sess->wsUrl, wsPort, wsPath)) {
        sess->alive.store(false);
        return 0;
    }

    SOCKET s = connectLoopback(wsPort, 3000);
    if (s == INVALID_SOCKET) {
        sess->alive.store(false);
        return 0;
    }
    // Remove receive timeout after handshake so WebSocket waits passively with 0% CPU
    std::string hs =
        "GET " + wsPath + " HTTP/1.1\r\n"
        "Host: 127.0.0.1:" + std::to_string(wsPort) + "\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n";

    if (!sendAll(s, hs.data(), hs.size())) {
        closesocket(s);
        sess->alive.store(false);
        return 0;
    }

    std::string resp;
    char ch = 0;
    while (resp.size() < 8192) {
        int n = recv(s, &ch, 1, 0);
        if (n <= 0) break;
        resp.push_back(ch);
        if (resp.size() >= 4 && resp.compare(resp.size() - 4, 4, "\r\n\r\n") == 0) break;
    }
    if (resp.find("101") == std::string::npos) {
        closesocket(s);
        sess->alive.store(false);
        return 0;
    }

    DWORD zeroTv = 0;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&zeroTv, sizeof(zeroTv));
    {
        std::lock_guard<std::mutex> lk(sess->sendMtx);
        sess->sock = s;
        LARGE_INTEGER pc{};
        QueryPerformanceCounter(&pc);
        sess->rngState ^= (uint64_t)pc.QuadPart ^ ((uint64_t)GetCurrentProcessId() << 16);
    }

    // Initial CDP setup + inject
    sess->sendCdp("Page.enable");
    sess->sendCdp("Runtime.enable");
    sess->sendCdp("Runtime.addBinding", "{\"name\":\"agySaveThemeConfig\"}");
    sess->reinject(true);
    logMsg("Attached target " + sess->id + " (" + sess->url + ")");

    // RFC-6455 frame receive loop
    std::string msgBuf;
    while (sess->alive.load() && g_running.load()) {
        uint8_t hdr[2];
        if (!recvExact(s, (char*)hdr, 2)) break;
        bool fin = (hdr[0] & 0x80) != 0;
        uint8_t opcode = hdr[0] & 0x0F;
        bool masked = (hdr[1] & 0x80) != 0;
        uint64_t plen = hdr[1] & 0x7F;
        if (plen == 126) {
            uint8_t ext[2];
            if (!recvExact(s, (char*)ext, 2)) break;
            plen = ((uint64_t)ext[0] << 8) | ext[1];
        } else if (plen == 127) {
            uint8_t ext[8];
            if (!recvExact(s, (char*)ext, 8)) break;
            plen = 0;
            for (int k = 0; k < 8; ++k) plen = (plen << 8) | ext[k];
        }
        uint8_t maskKey[4] = {0, 0, 0, 0};
        if (masked && !recvExact(s, (char*)maskKey, 4)) break;
        if (plen > 32ULL * 1024 * 1024) break;

        std::string payload((size_t)plen, '\0');
        if (plen > 0 && !recvExact(s, &payload[0], (size_t)plen)) break;
        if (masked) {
            for (size_t k = 0; k < payload.size(); ++k) payload[k] = (char)((uint8_t)payload[k] ^ maskKey[k & 3]);
        }

        if (opcode == 0x8) break; // close
        if (opcode == 0x9) {      // ping -> pong
            sess->sendWsFrame(0xA, payload.data(), payload.size());
            continue;
        }
        if (opcode == 0xA) continue; // pong

        if (opcode == 0x1 || opcode == 0x0) {
            msgBuf += payload;
            if (!fin) continue;

            // Only parse messages that matter (fast substring filter avoids JSON parsing noise!)
            bool interesting =
                msgBuf.find("agySaveThemeConfig") != std::string::npos ||
                msgBuf.find("Page.frameNavigated") != std::string::npos ||
                (sess->pendingDocReqId > 0 && msgBuf.find("\"identifier\"") != std::string::npos);

            if (interesting) {
                JsonVal msg;
                if (parseJson(msgBuf, msg) && msg.type == JsonVal::JObj) {
                    if (const JsonVal* idv = msg.get("id"); idv && idv->type == JsonVal::JNum) {
                        int rid = std::atoi(idv->sval.c_str());
                        if (rid == sess->pendingDocReqId && rid > 0) {
                            if (const JsonVal* res = msg.get("result")) {
                                if (const JsonVal* ident = res->get("identifier")) {
                                    sess->lastDocScriptId = ident->asStr();
                                }
                            }
                            sess->pendingDocReqId = 0;
                        }
                    }
                    std::string method = msg.get("method") ? msg.get("method")->asStr() : "";
                    if (method == "Runtime.bindingCalled") {
                        const JsonVal* params = msg.get("params");
                        if (params && params->get("name") && params->get("name")->asStr() == "agySaveThemeConfig") {
                            std::string pStr = params->get("payload") ? params->get("payload")->asStr("{}") : "{}";
                            if (saveConfigMerge(pStr)) {
                                reinjectAllSessions(sess->id, true);
                            }
                        }
                    } else if (method == "Page.frameNavigated") {
                        const JsonVal* params = msg.get("params");
                        const JsonVal* frame = params ? params->get("frame") : nullptr;
                        if (frame && (!frame->get("parentId") || frame->get("parentId")->asStr().empty())) {
                            sess->reinject(false);
                        }
                    }
                }
            }
            msgBuf.clear();
            if (msgBuf.capacity() > 65536) msgBuf.shrink_to_fit();
        }
    }

    sess->close();
    {
        std::lock_guard<std::mutex> lk(g_sessionsMtx);
        auto it = g_sessions.find(sess->id);
        if (it != g_sessions.end() && it->second == sess) {
            g_sessions.erase(it);
        }
    }
    return 0;
}

// --- DevToolsActivePort & Page Scanner ---
std::wstring resolvePortFile() {
    std::wstring envP = getEnvWide(L"AGY_PORT_FILE");
    if (!envP.empty()) return envP;
    std::wstring appData = getEnvWide(L"APPDATA");
    std::wstring p1 = appData + L"\\antigravity\\DevToolsActivePort";
    if (fileExists(p1)) return p1;
    std::wstring p2 = appData + L"\\Antigravity\\DevToolsActivePort";
    if (fileExists(p2)) return p2;
    return p1;
}

uint16_t readActivePort() {
    std::string raw;
    if (!readFileAll(resolvePortFile(), raw)) return 0;
    int p = std::atoi(raw.c_str());
    return (p > 0 && p <= 65535) ? (uint16_t)p : 0;
}

uint16_t g_lastCdpPort = 0;

void scanPages() {
    uint16_t port = readActivePort();
    if (port == 0) return;

    if (g_lastCdpPort != 0 && g_lastCdpPort != port) {
        std::vector<std::shared_ptr<CdpSession>> old;
        {
            std::lock_guard<std::mutex> lk(g_sessionsMtx);
            for (auto& kv : g_sessions) old.push_back(kv.second);
            g_sessions.clear();
        }
        for (auto& s : old) s->close();
    }
    g_lastCdpPort = port;

    std::string body;
    if (!httpGetLoopback(port, "/json", body)) return;
    JsonVal targets;
    if (!parseJson(body, targets) || targets.type != JsonVal::JArr) return;

    struct PageTarget { std::string id, url, wsUrl; };
    std::vector<PageTarget> pages;
    std::set<std::string> liveIds;
    for (const auto& t : targets.arr) {
        if (t.type != JsonVal::JObj) continue;
        std::string type = t.get("type") ? t.get("type")->asStr() : "";
        std::string wsUrl = t.get("webSocketDebuggerUrl") ? t.get("webSocketDebuggerUrl")->asStr() : "";
        std::string id = t.get("id") ? t.get("id")->asStr() : "";
        std::string url = t.get("url") ? t.get("url")->asStr() : "";
        if (type != "page" || wsUrl.empty() || id.empty()) continue;
        if (url.rfind("devtools://", 0) == 0 || url.rfind("chrome-extension://", 0) == 0) continue;
        if (url.find("127.0.0.1") == std::string::npos &&
            url.find("workbench") == std::string::npos &&
            url.find("launchpad") == std::string::npos) continue;
        pages.push_back({id, url, wsUrl});
        liveIds.insert(id);
    }

    std::vector<std::shared_ptr<CdpSession>> stale;
    std::vector<std::shared_ptr<CdpSession>> toStart;
    {
        std::lock_guard<std::mutex> lk(g_sessionsMtx);
        for (auto it = g_sessions.begin(); it != g_sessions.end();) {
            if (!liveIds.count(it->first) || !it->second->alive.load()) {
                stale.push_back(it->second);
                it = g_sessions.erase(it);
            } else {
                ++it;
            }
        }
        for (const auto& p : pages) {
            if (!g_sessions.count(p.id)) {
                auto sess = std::make_shared<CdpSession>();
                sess->id = p.id;
                sess->url = p.url;
                sess->wsUrl = p.wsUrl;
                g_sessions[p.id] = sess;
                toStart.push_back(sess);
            }
        }
    }
    for (auto& s : stale) s->close();
    for (auto& s : toStart) {
        auto* holder = new std::shared_ptr<CdpSession>(s);
        uintptr_t th = _beginthreadex(nullptr, 131072, sessionThreadProc, holder, 0, nullptr);
        if (th) {
            CloseHandle((HANDLE)th);
        } else {
            delete holder;
            s->alive.store(false);
        }
    }
}

uint64_t fnv1aWide(const std::wstring& s) {
    uint64_t h = 14695981039346656037ULL;
    for (wchar_t c : s) {
        wchar_t lc = (wchar_t)towlower(c);
        h ^= (uint64_t)(lc & 0xFF); h *= 1099511628211ULL;
        h ^= (uint64_t)((lc >> 8) & 0xFF); h *= 1099511628211ULL;
    }
    return h;
}

void writePidFile() {
    writeFileAtomic(g_pidFile, std::to_string(GetCurrentProcessId()));
}

void removePidFile() {
    std::string raw;
    if (readFileAll(g_pidFile, raw)) {
        if ((DWORD)std::strtoul(raw.c_str(), nullptr, 10) == GetCurrentProcessId()) {
            DeleteFileW(g_pidFile.c_str());
        }
    }
}

} // namespace

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    wchar_t exeBuf[MAX_PATH * 4];
    DWORD exeLen = GetModuleFileNameW(nullptr, exeBuf, (DWORD)(sizeof(exeBuf) / sizeof(wchar_t)));
    if (exeLen == 0) return 1;
    std::wstring exeDir = parentDir(std::wstring(exeBuf, exeLen));
    g_rootDir = parentDir(exeDir);
    g_themesDir = g_rootDir + L"\\themes";
    g_pidFile = g_rootDir + L"\\daemon.pid";
    std::wstring envCfg = getEnvWide(L"AGY_CONFIG_PATH");
    g_configFile = envCfg.empty() ? (g_rootDir + L"\\theme_config.json") : envCfg;
    g_payloadPath = g_rootDir + L"\\dist\\theme_payload.js";
    g_logFile = g_rootDir + L"\\daemon.log";

    // Single-instance Windows named mutex per repo directory
    wchar_t mtxName[128];
    std::swprintf(mtxName, 128, L"Local\\AgyThemeDaemon_%016llx", (unsigned long long)fnv1aWide(g_rootDir));
    HANDLE hMtx = CreateMutexW(nullptr, TRUE, mtxName);
    if (!hMtx || GetLastError() == ERROR_ALREADY_EXISTS) {
        if (hMtx) CloseHandle(hMtx);
        return 0;
    }

    WSADATA wsa{};
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        CloseHandle(hMtx);
        return 1;
    }

    writePidFile();
    logMsg("Native theme daemon started (PID " + std::to_string(GetCurrentProcessId()) +
           ", portFile=" + wideToUtf8(resolvePortFile()) + ").");

    uintptr_t srvThread = _beginthreadex(nullptr, 131072, assetServerThread, nullptr, 0, nullptr);
    for (int k = 0; k < 40 && g_assetPort.load() == 0; ++k) Sleep(25);

    uint64_t lastPayloadTime = getFileWriteTime64(g_payloadPath);
    uint64_t pendingReloadAt = 0;
    uint64_t lastScanAt = 0;
    uint64_t lastTrimAt = GetTickCount64();

    scanPages();
    lastScanAt = GetTickCount64();

    while (g_running.load()) {
        Sleep(250);
        uint64_t now = GetTickCount64();

        // Check dist/theme_payload.js modification with 250ms debounce
        uint64_t curMt = getFileWriteTime64(g_payloadPath);
        if (curMt != 0 && curMt != lastPayloadTime) {
            lastPayloadTime = curMt;
            pendingReloadAt = now + 250;
        }
        if (pendingReloadAt != 0 && now >= pendingReloadAt) {
            pendingReloadAt = 0;
            logMsg("Detected dist/theme_payload.js update; hot-reloading attached pages.");
            reinjectAllSessions("", true);
            lastTrimAt = now;
        }

        // Poll CDP targets every 1500ms
        if (now - lastScanAt >= 1500) {
            lastScanAt = now;
            scanPages();
        }

        // Periodic idle working-set trim every 15s
        if (now - lastTrimAt >= 15000) {
            lastTrimAt = now;
            trimWorkingSet();
        }
    }

    if (srvThread) {
        WaitForSingleObject((HANDLE)srvThread, 1000);
        CloseHandle((HANDLE)srvThread);
    }
    removePidFile();
    WSACleanup();
    CloseHandle(hMtx);
    return 0;
}

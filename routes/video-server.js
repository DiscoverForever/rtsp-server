const axios = require('axios');
const Stream = require('node-rtsp-stream');
const {
  exec,
  spawn
} = require('child_process');
// const BASE_URL = 'http://127.0.0.1:8080/api/';
const HOST = 'http://127.0.0.1';
const BASE_URL = 'http://127.0.0.1:8080/api';
const STARED_SERVERS = [];
let BASE_PORT = 7000;
/**
 * 启动服务
 * @param {*} req 
 * @param {*} res 
 */
async function startServer(req, res) {
  const name = req.query.name ? req.query.name : 'name';
  const streamUrl = req.query.streamUrl;
  // 查找已启动的rtsp视频转换服务
  const startedServer = STARED_SERVERS.find(streaServer => streaServer.streamUrl === streamUrl);
  const port = startedServer ? startedServer.port : BASE_PORT ++;
  
  // 查找当前HOST的集群是否已经存在
  let clusters = await searchCluster(`videoServerIp:"${HOST}"`);
  let cluster = clusters[0];
  let stream = startedServer && startedServer.stream;
  console.log(STARED_SERVERS)
  if (!startedServer) {
    stream = new Stream({
      name,
      streamUrl,
      wsPort: port
    });
    listenAndHandleErrorStream(stream);
    stream.once('camdata', async () => {
      console.log('pid', stream.mpeg1Muxer.stream.pid)
      // 模拟异常中断
      // stream.mpeg1Muxer.stream.kill();

      res.jsonp({
        data: {
          port,
          wsUrl: `${HOST.replace(/http/, 'ws')}:${port}`,
          cluster,
          pid: stream.mpeg1Muxer.stream.pid
        }
      });
    });
    // stream.on('camdata', async (data) => {
    //   console.log(data.toString())
    // });
    STARED_SERVERS.push({
      port,
      wsUrl: `${HOST.replace(/http/, 'ws')}:${port}`,
      stream,
      streamUrl,
      cluster,
      pid: stream.mpeg1Muxer.stream.pid
    });
  } else {
    res.jsonp({data: { wsUrl: startedServer.wsUrl }});
  }
  if (clusters.length > 0) {
    cluster = await updateCluster(Object.assign(cluster, { videoChannelNumber : cluster.videoChannelNumber + 1 }))
  } else {
    cluster = await createCluster(HOST, 'rtsp-server', HOST, 'cetc', 0, HOST, 'root', process.env.PORT || '3000', 'root');
  }

}

/**
 * 关闭服务
 * @param {*} port 
 */
async function stopServer(req, res) {
  const pid = req.query.pid;
  try {
    let res = await killThreadByPid(pid);
    res.jsonp({
      data: {
        pid
      }
    });
  } catch (error) {
    res.status(500);
    res.send(error)
  }
}

function killThreadByPid(pid) {
  return new Promise((resolve, reject) => {
    exec(`kill -9 ${pid}`, (err, stdout, stderr) => {
      if (err) {
        console.error('子进程:', pid, '进程关闭失败', err.message);
        reject(err.message);
      } else {
        console.log('子进程:', pid, '进程关闭成功');
        resolve(pid);
      }   
    });
  }); 
}

/**
 * 重启服务
 * @param {*} port 
 */
function restartServer(req, res) {
  stopServer(req.query.pid);
  startServer(req.query.port);
}

/**
 * 创建集群节点
 * @param {*} clusterNodeIp 
 * @param {*} clusterNodeName 
 * @param {*} dbIp 
 * @param {*} dbName 
 * @param {*} videoChannelNumber 
 * @param {*} videoServerIp 
 * @param {*} videoServerPassword 
 * @param {*} videoServerPort 
 * @param {*} videoServerUsername 
 */
async function createCluster(clusterNodeIp, clusterNodeName, dbIp, dbName, videoChannelNumber, videoServerIp, videoServerPassword, videoServerPort, videoServerUsername) {
  const params = {
    clusterNodeIp,
    clusterNodeName,
    dbIp,
    dbName,
    videoChannelNumber,
    videoServerIp,
    videoServerPassword,
    videoServerPort,
    videoServerUsername
  };
  const Authorization = await getJWT();
  const options = {
    headers: {
      Authorization
    }
  }
  const res = await axios.post(`${BASE_URL}/clusters`, params, options);
  
  return res.data;
}

async function updateCluster(cluster) {
  const Authorization = await getJWT();
  const options = {
    headers: {
      Authorization
    }
  }
  const res = await axios.put(`${BASE_URL}/clusters`, cluster, options);
  return res.data;
}

async function searchCluster(query) {
  const Authorization = await getJWT();
  const options = {
    headers: {
      Authorization
    },
    params: {
      query
    }
  }
  const res = await axios.get(`${BASE_URL}/_search/clusters`, options);
  return res.data;
}

async function getJWT(username = 'admin', password = 'admin') {
  const params = {
    username,
    password,
    rememberMe: true
  };

  let res;
  try {
    res = await axios.post(`${BASE_URL}/authenticate`, params);
  } catch (error) {
    console.error('获取token失败!', error);
  }
  return `Bearer ${res.data.id_token}`;
}

function listenAndHandleErrorStream(stream) {
  stream.mpeg1Muxer.on('ffmpegError', async (error) => {
    console.error('FATAL ERROR', error.toString())
    if (error.toString().indexOf('Lsize=') > 0) {
      console.error('websocket视频解析服务出错', error.toString(), error.toString().indexOf('Lsize='));
      const newStream = stream.startMpeg1Stream();
      listenAndHandleErrorStream(newStream);
    } else if (error.toString().indexOf('Network is unreachable') > 0) {
      console.error('网络连接失败', error.toString());
    }
  });
}


module.exports = {
  startServer,
  stopServer
}
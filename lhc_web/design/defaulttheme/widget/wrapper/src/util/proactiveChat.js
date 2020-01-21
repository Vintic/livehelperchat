import {helperFunctions} from '../lib/helperFunctions';
import {domEventsHandler} from '../util/domEventsHandler';

class _proactiveChat {

    constructor() {
        this.params = {};
        this.timeoutStatuscheck = null;
        this.timeoutActivity = null;
        this.attributes = null;
        this.chatEvents = null;
        this.dynamicInvitations = [];

        this.iddleTimeoutActivity = null;
        this.checkMessageTimeout = null;
        this.nextRescheduleTimeout = null;
    }

    setParams(params, attributes, chatEvents) {
        this.params = params;
        this.attributes = attributes;
        this.chatEvents = chatEvents;
        this.initInvitation();

        // check invitaiton then tag is added
        this.attributes.eventEmitter.addListener('tagAdded', () => {
            this.initInvitation({init: 0});
        });

        this.attributes.eventEmitter.addListener('checkMessageOperator', () => {
            this.initInvitation({init: 0});
        });
    }

    showInvitation(params) {

        const chatParams = this.attributes['userSession'].getSessionAttributes();

        // Show invitation only if widget is not open
        if (this.attributes.widgetStatus.value === true || chatParams['id']) {
            return;
        }

        if (params.inject_html && params.invitation) {
            var th = document.getElementsByTagName('head')[0];
            var s = document.createElement('script');
            s.setAttribute('type','text/javascript');
            s.setAttribute('src', LHC_API.args.lhc_base_url + 'chat/htmlsnippet/'+params.invitation+'/inv/0/?ts='+Date.now());
            th.appendChild(s);
        }

        if (!params.only_inject) {
            this.chatEvents.sendChildEvent('proactive', [params]);
            clearTimeout(this.checkMessageTimeout);
            clearTimeout(this.nextRescheduleTimeout);
        }
    }

    initInvitation(paramsExecution) {

        clearTimeout(this.checkMessageTimeout);

        const chatParams = this.attributes['userSession'].getSessionAttributes();

        const init = (paramsExecution && paramsExecution['init'] === 0) ? 0 : 1;

        if (!chatParams['id'] && this.attributes['onlineStatus'].value == true) {
            let params = {
                'vid': this.attributes.userSession.getVID(),
                'dep': this.attributes.department.join(',')
            };

            if (LHC_API.args.priority) {
                params['priority'] = LHC_API.args.priority;
            }

            if (LHC_API.args.operator) {
                params['operator'] = LHC_API.args.operator;
            }

            if (this.attributes['identifier']) {
                params['idnt'] = this.attributes['identifier']
            }

            if (this.attributes['tag']) {
                params['tag'] = this.attributes['tag']
            }

            params['l'] = encodeURIComponent(window.location.href.substring(window.location.protocol.length));
            params['dt'] = encodeURIComponent(document.title);
            params['init'] = init;

            helperFunctions.makeRequest(LHC_API.args.lhc_base_url + '/widgetrestapi/checkinvitation', {params: params}, (data) => {
                if (data.invitation) {
                    const params = {'vid_id' : data.vid_id, 'invitation' : data.invitation, 'inject_html' :  data.inject_html};
                    setTimeout(() => {
                        this.showInvitation(params);
                    }, data.delay || 0);
                } else {
                    if (LHC_API.args.check_messages) {
                        this.checkMessageTimeout = setTimeout(() => {
                            this.initInvitation({init: 0});
                        },this.params['interval'] * 1000);
                    }
                }

                if (data.next_reschedule) {
                    this.nextRescheduleTimeout = setTimeout(() => {
                        this.initInvitation({init: 0});
                    }, data.next_reschedule);
                }

                if (data.dynamic) {
                    data.dynamic.forEach((item) => {
                        this.dynamicInvitations.push(item.id);
                        if (item.type === 1) {
                            domEventsHandler.listen(document, 'mouseout', (e) => {
                                e = e ? e : window.event;
                                var from = e.relatedTarget || e.toElement;
                                if (!from || from.nodeName == "HTML") {
                                    this.showInvitation({'vid_id' : data.vid_id, 'invitation' : item.id, 'inject_html' :  item.inject_html, 'only_inject' : item.only_inject});
                                    if (!item.every_time) {
                                        domEventsHandler.unlisten('lhc_inv_mouse_out_'+item.id);
                                    }
                                }
                            }, 'lhc_inv_mouse_out_' + item.id);
                        } else if (item.type === 2) {

                            var iddleTimeout = () => {

                                this.showInvitation({'vid_id' : data.vid_id, 'invitation' : item.id, 'inject_html' :  item.inject_html, 'only_inject' : item.only_inject});

                                clearTimeout(this.iddleTimeoutActivity);

                                if (!item.every_time) {
                                    ['mousemove','mousedown','click','scroll','keypress','load'].forEach((element) => {
                                        domEventsHandler.unlisten('lhc_inv_iddl_win_'+element);
                                    });

                                    ['mousemove','scroll','touchstart','touchend'].forEach((element) => {
                                        domEventsHandler.unlisten('lhc_inv_iddl_doc_'+element);
                                    });
                                }
                            };

                            this.iddleTimeoutActivityReset = () => {
                                clearTimeout(this.iddleTimeoutActivity);
                                this.iddleTimeoutActivity = setTimeout( () => { iddleTimeout(); }, item.iddle_for *1000);
                            }

                            this.iddleTimeoutActivityReset();

                            ['mousemove','mousedown','click','scroll','keypress','load'].forEach((event) => {
                                    domEventsHandler.listen(window, event, this.iddleTimeoutActivityReset, 'lhc_inv_iddl_win_'+event);
                            });

                            ['mousemove','scroll','touchstart','touchend'].forEach((event) => {
                                domEventsHandler.listen(document, event, this.iddleTimeoutActivityReset, 'lhc_inv_iddl_doc_'+event);
                            });
                        }
                    })
                }
            });
        }

        /*startNewMessageCheckSingle : function() {
            if (!lh_inst.cookieData.hash) {
                var vid = this.cookieDataPers.vid;
                lh_inst.removeById('lhc_operator_message');
                var th = document.getElementsByTagName('head')[0];
                var s = document.createElement('script');
                var locationCurrent = encodeURIComponent(window.location.href.substring(window.location.protocol.length));
                var tzOffset = this.getTzOffset();

                var dynamic = this.dynamicAssigned.length > 0 ? '/(dyn)/' +  this.dynamicAssigned.join('/'): '';

                s.setAttribute('id','lhc_operator_message');
                s.setAttribute('type','text/javascript');
                s.setAttribute('src','<?php echo erLhcoreClassModelChatConfig::fetch('explicit_http_mode')->current_value?>//<?php echo $_SERVER['HTTP_HOST']?>
                <?php echo erLhcoreClassDesign::baseurlsite()?>'+this.lang+'/chat/chatcheckoperatormessage<?php $priority !== false ? print '/(priority)/'.$priority : ''?>
                <?php is_object($theme) ? print '/(theme)/'.$theme->id : ''?>
                <?php $operator !== false ? print '/(operator)/'.$operator : ''?>
                <?php $department !== false ? print '/(department)/'.$department : ''?>
                <?php $identifier !== false ? print '/(identifier)/'.htmlspecialchars($identifier) : ''?>
                <?php $uarguments !== false ? print '/(ua)/'.$uarguments : '' ?>
                <?= isset($currentPosition['full_height']) && $currentPosition['full_height'] ?  '/(fullheight)/true' : '/(fullheight)/false' ?>/(tz)/' + tzOffset + this.survey_id + '/(count_page)/1/(vid)/'+vid+'/(uactiv)/'+lh_inst.userActive+'/(wopen)/'+lh_inst.timeoutStatusWidgetOpen+dynamic+'?l='+locationCurrent+this.tag+this.parseStorageArguments()+this.parseOptionsOnline()+this.parseOptions()+'&dt='+encodeURIComponent(document.title)+'&ts='+Date.now());
                th.appendChild(s);
            }
        },*/
    }

    /*syncUserStatus(sender) {
        const chatParams = this.attributes['userSession'].getSessionAttributes();

        let params = {
            'vid': this.attributes.userSession.getVID(),
            'wopen': (this.attributes.widgetStatus.value ? 1 : 0),
            'uaction': sender,
            'uactiv': this.userActive,
            'dep': this.attributes.department.join(',')
        };

        if (chatParams['id'] && chatParams['hash']) {
            params['hash'] = chatParams['id'] + '_' + chatParams['hash'];
        }

        helperFunctions.makeRequest(LHC_API.args.lhc_base_url + '/widgetrestapi/chatcheckstatus', {params: params}, (data) => {
            if (data.change_status == true && this.attributes.onlineStatus.value != data.online) {
                this.attributes.onlineStatus.next(data.online);
            }
        });
    }*/

    /*
    startNewMessageCheck : function() {
    	/*var vid = this.cookieDataPers.vid;
    	var inst = this;
    	var locationCurrent = encodeURIComponent(window.location.href.substring(window.location.protocol.length));

        this.timeoutInstance = setTimeout(function() {
            lh_inst.removeById('lhc_operator_message');
            var dynamic = inst.dynamicAssigned.length > 0 ? '/(dyn)/' +  inst.dynamicAssigned.join('/') : '';
            var th = document.getElementsByTagName('head')[0];
            var s = document.createElement('script');
            s.setAttribute('id','lhc_operator_message');
            s.setAttribute('type','text/javascript');
            s.setAttribute('src','<?php echo erLhcoreClassModelChatConfig::fetch('explicit_http_mode')->current_value?>//<?php echo $_SERVER['HTTP_HOST']?><?php echo erLhcoreClassDesign::baseurlsite()?>'+lh_inst.lang+'/chat/chatcheckoperatormessage<?php $priority !== false ? print '/(priority)/'.$priority : ''?><?php $theme !== false ? print '/(theme)/'.$theme->id : ''?><?php $operator !== false ? print '/(operator)/'.$operator : ''?><?php $department !== false ? print '/(department)/'.$department : ''?><?php $identifier !== false ? print '/(identifier)/'.htmlspecialchars($identifier) : ''?><?php $uarguments !== false ? print '/(ua)/'.$uarguments : '' ?><?= isset($currentPosition['full_height']) && $currentPosition['full_height'] ?  '/(fullheight)/true' : '/(fullheight)/false' ?>/(vid)/'+vid + lh_inst.survey_id + '/(uactiv)/'+lh_inst.userActive+'/(wopen)/'+lh_inst.timeoutStatusWidgetOpen+dynamic+'?l='+locationCurrent+inst.tag+'&dt='+encodeURIComponent(document.title)+'&ts='+Date.now());
            th.appendChild(s);
            lh_inst.startNewMessageCheck();
        }, <?php echo (int)(erLhcoreClassModelChatConfig::fetch('sync_sound_settings')->data['check_for_operator_msg']*1000); ?> );
    },

    */

}

const proactiveChat = new _proactiveChat();
export {proactiveChat};

